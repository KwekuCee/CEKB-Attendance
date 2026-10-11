import React, { useMemo, useRef, useState } from 'react';
import { ChurchBranch, Leader, Member } from '../types';
import {
  HeaderMapResult,
  ImportKind,
  PreparedRow,
  TEMPLATE_COLUMNS,
  buildExistingIndex,
  collectLeadersFromRows,
  downloadImportTemplate,
  fieldLabel,
  initialsOf,
  nameKey,
  toTitleCase,
  prepareRows,
  readSpreadsheet,
} from '../utils/importUtils';
import { IncompleteLeadersPanel } from './IncompleteLeadersPanel';
import {
  generateLeaderCode,
  saveLeaderToSupabase,
  saveMemberToSupabase,
  sendQrPassEmails,
  syncLeaderAsMember,
} from '../lib/supabaseService';

interface ImportDataPanelProps {
  members: Member[];
  leaders: Leader[];
  churches: ChurchBranch[];
  /** Branch the admin belongs to; group account may pick any branch. */
  defaultChurch: string;
  canChooseChurch: boolean;
  onImported: (newMembers: Member[], newLeaders: Leader[]) => void;
}

interface ImportSummary {
  membersAdded: number;
  leadersAdded: number;
  leadersNeedingDetails: number;
  skipped: number;
  rejected: number;
}

export const ImportDataPanel: React.FC<ImportDataPanelProps> = ({
  members,
  leaders,
  churches,
  defaultChurch,
  canChooseChurch,
  onImported,
}) => {
  const [kind, setKind] = useState<ImportKind>('members');
  const [church, setChurch] = useState(defaultChurch || churches[0]?.name || '');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreparedRow[]>([]);
  const [headerResult, setHeaderResult] = useState<HeaderMapResult | null>(null);
  const [newIncompleteLeaders, setNewIncompleteLeaders] = useState<Leader[]>([]);
  const [readError, setReadError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [emailProgress, setEmailProgress] = useState(0);
  const [isEmailing, setIsEmailing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(() => buildExistingIndex(members, leaders), [members, leaders]);

  const churchOptions = useMemo(
    () =>
      Array.from(new Set((churches || []).map((c) => c?.name).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b)
      ),
    [churches]
  );

  const goodRows = rows.filter((r) => r.valid);
  const dupRows = rows.filter((r) => r.duplicate);
  const badRows = rows.filter((r) => !r.valid && !r.duplicate);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setReadError('');
    setSummary(null);
    setEmailStatus('');
    setIsReading(true);
    try {
      const grid = await readSpreadsheet(file);
      if (grid.length < 2) {
        setRows([]);
        setReadError('That file has no rows below the column headings.');
      } else {
        const prepared = prepareRows(grid, { kind, church, existing });
        setRows(prepared.rows);
        setHeaderResult({
          map: prepared.headerMap,
          matched: prepared.matchedHeaders,
          unmatched: prepared.unmatchedHeaders,
        });
        if (!prepared.rows.length) setReadError('No usable rows were found in that file.');
      }
      setFileName(file.name);
    } catch (err: any) {
      setRows([]);
      setHeaderResult(null);
      setReadError(err?.message || 'That file could not be read. Please use .xlsx or .csv.');
    } finally {
      setIsReading(false);
    }
  };

  const reset = () => {
    setRows([]);
    setHeaderResult(null);
    setNewIncompleteLeaders([]);
    setFileName('');
    setReadError('');
    setSummary(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleImport = async () => {
    if (isImporting || !goodRows.length) return;
    setIsImporting(true);
    const addedMembers: Member[] = [];
    const addedLeaders: Leader[] = [];

    try {
      const leaderIdsByName = new Map<string, string>();

      if (kind === 'members') {
        const derived = collectLeadersFromRows(goodRows, { church, existingLeaders: leaders });
        for (const item of derived) {
          if (item.existingLeaderId) {
            leaderIdsByName.set(item.key, item.existingLeaderId);
            continue;
          }

          const code = generateLeaderCode();
          const leader: Leader = {
            id: code,
            leaderCode: code,
            fullName: item.name,
            contact: item.phone,
            email: item.email,
            dob: item.dob,
            location: item.location || 'Not Specified',
            leaderType: 'BSCT',
            cellOrPcfName: '',
            church: item.church || church,
            isAppointed: false,
            downstreamCount: item.memberCount,
            promotionStatus: 'Confirmed',
            joinedDate: new Date().toISOString().slice(0, 10),
            initials: initialsOf(item.name),
          };
          const ok = await saveLeaderToSupabase(leader);
          if (ok) {
            leaderIdsByName.set(item.key, leader.id);
            await syncLeaderAsMember(leader).catch(() => null);
            addedLeaders.push(leader);
          }
        }
      }

      for (const row of goodRows) {
        if (kind === 'members' && row.member) {
          const rawInvitedBy = (row.raw.invitedBy || '').trim();
          const leaderId = rawInvitedBy ? leaderIdsByName.get(nameKey(rawInvitedBy)) : undefined;
          const matchedLeader = leaderId
            ? leaders.find((l) => l.id === leaderId) || addedLeaders.find((l) => l.id === leaderId)
            : undefined;

          const cleanInvitedByName = matchedLeader
            ? matchedLeader.fullName
            : rawInvitedBy
            ? toTitleCase(rawInvitedBy)
            : row.member.invitedBy || 'Spreadsheet Import';

          const member: Member = {
            ...(row.member as Member),
            id: `CE-${Math.floor(1000 + Math.random() * 9000)}`,
            fullName: toTitleCase(row.member.fullName || ''),
            initials: initialsOf(row.member.fullName || ''),
            church: row.member.church || church,
            invitedBy: cleanInvitedByName,
            invitedByLeaderId: leaderId,
          };
          const ok = await saveMemberToSupabase(member);
          if (ok) addedMembers.push(member);
        } else if (kind === 'leaders' && row.leader) {
          const cleanLeaderName = toTitleCase(row.leader.fullName || '');
          const code = generateLeaderCode();
          const leader: Leader = {
            ...(row.leader as Leader),
            id: code,
            leaderCode: code,
            fullName: cleanLeaderName,
            initials: initialsOf(cleanLeaderName),
            church: row.leader.church || church,
            isAppointed: false,
            downstreamCount: 0,
            promotionStatus: 'Confirmed',
            joinedDate: new Date().toISOString().slice(0, 10),
          };
          const ok = await saveLeaderToSupabase(leader);
          if (ok) {
            await syncLeaderAsMember(leader).catch(() => null);
            addedLeaders.push(leader);
          }
        }
      }

      onImported(addedMembers, addedLeaders);
      setNewIncompleteLeaders(addedLeaders);
      setSummary({
        membersAdded: addedMembers.length,
        leadersAdded: addedLeaders.length,
        leadersNeedingDetails: addedLeaders.length,
        skipped: dupRows.length,
        rejected: badRows.length,
      });
      setRows([]);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setIsImporting(false);
    }
  };

  const emailCodes = async (target: 'members' | 'leaders') => {
    if (isEmailing) return;
    setIsEmailing(true);
    setEmailProgress(0);
    setEmailStatus('Preparing…');

    const scoped = (list: { church?: string }[]) =>
      canChooseChurch ? list : list.filter((x) => (x.church || '').toLowerCase() === (defaultChurch || '').toLowerCase());

    const people =
      target === 'members'
        ? (scoped(members) as Member[]).map((m) => ({
            id: m.id,
            name: m.fullName,
            email: m.email || '',
            church: m.church,
          }))
        : (scoped(leaders) as Leader[]).map((l) => ({
            id: l.leaderCode || l.id,
            name: l.fullName,
            email: l.email || '',
            church: l.church,
            role: l.leaderType,
          }));

    const withEmail = people.filter((p) => p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email));
    const without = people.length - withEmail.length;

    if (!withEmail.length) {
      setEmailStatus(`No email addresses on file for these ${target}.`);
      setIsEmailing(false);
      return;
    }

    let sent = 0;
    let failed = 0;
    const batchSize = 25;

    for (let i = 0; i < withEmail.length; i += batchSize) {
      const batch = withEmail.slice(i, i + batchSize);
      setEmailStatus(`Sending ${i + 1}–${Math.min(i + batch.length, withEmail.length)} of ${withEmail.length}…`);
      const result = await sendQrPassEmails(batch);
      sent += result.sent;
      failed += result.failed;
      setEmailProgress(Math.round(Math.min(i + batch.length, withEmail.length) / withEmail.length * 100));
    }

    setEmailStatus(
      `${sent} sent${failed ? `, ${failed} could not be delivered` : ''}${
        without ? `, ${without} had no email address` : ''
      }.`
    );
    setIsEmailing(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-700 text-[22px]">upload_file</span>
            Import from Spreadsheet
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add many people at once from an Excel (.xlsx) or CSV file, then email everyone their attendance code.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadImportTemplate(kind)}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Download template</span>
          </button>
          {fileName && (
            <button onClick={reset} className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
              Clear file
            </button>
          )}
        </div>
      </div>

      {/* Column guide */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-bold text-slate-700">
            Columns the system reads for {kind === 'members' ? 'members' : 'leaders'}
          </p>
          <button
            onClick={() => setShowColumns((v) => !v)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
          >
            {showColumns ? 'Hide' : 'Show all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TEMPLATE_COLUMNS[kind].map((c) => (
            <span
              key={c.header}
              title={c.note}
              className={`text-xs font-semibold px-2 py-1 rounded-lg border ${
                c.required
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {c.header}
              {c.required ? ' *' : ''}
            </span>
          ))}
        </div>
        {showColumns && (
          <ul className="mt-2 space-y-1">
            {TEMPLATE_COLUMNS[kind].map((c) => (
              <li key={c.header} className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">{c.header}</span>
                {c.required ? <span className="text-blue-700 font-bold"> (required)</span> : ''} — {c.note}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Download the template, replace the two example rows with your own people, and upload it. Extra columns are
          ignored, and the order does not matter.
        </p>
      </div>


      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">This file contains</label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              reset();
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
          >
            <option value="members">Members</option>
            <option value="leaders">Leaders</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Church branch</label>
          {canChooseChurch ? (
            <select
              value={church}
              onChange={(e) => setChurch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            >
              {churchOptions.length === 0 && <option value={church}>{church || 'No branches yet'}</option>}
              {churchOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700">
              {defaultChurch || 'Your branch'}
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer?.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-400'
        }`}
      >
        <span className="material-symbols-outlined text-blue-700 text-[30px]">cloud_upload</span>
        <p className="text-xs font-bold text-slate-800 mt-1">
          {fileName || 'Drag your file here, or tap to choose one'}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">Accepted: .xlsx or .csv</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {isReading && <p className="text-xs font-semibold text-blue-700">Reading your file…</p>}
      {readError && (
        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{readError}</p>
      )}

      {headerResult && (
        <div className="border border-slate-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-slate-800">Columns found in your file</p>
          <div className="flex flex-wrap gap-1.5">
            {headerResult.matched.map((item) => (
              <span key={`${item.header}-${item.field}`} className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg">
                {item.header} → {fieldLabel(item.field)}
              </span>
            ))}
          </div>
          {headerResult.unmatched.length > 0 && (
            <p className="text-xs text-amber-800">
              Not imported: <span className="font-semibold">{headerResult.unmatched.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap text-xs font-bold">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
              {goodRows.length} ready
            </span>
            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">
              {dupRows.length} already in the system
            </span>
            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full">
              {badRows.length} need fixing
            </span>
          </div>

          <div className="max-h-72 overflow-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-500">
                  <th className="p-2 font-bold">Row</th>
                  <th className="p-2 font-bold">Name</th>
                  <th className="p-2 font-bold">Phone</th>
                  <th className="p-2 font-bold">Email</th>
                  <th className="p-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} className="border-t border-slate-100">
                    <td className="p-2 text-slate-400">{r.index}</td>
                    <td className="p-2 font-semibold text-slate-900">{r.raw.fullName || '—'}</td>
                    <td className="p-2 text-slate-600">{r.raw.phone || '—'}</td>
                    <td className="p-2 text-slate-600">{r.raw.email || '—'}</td>
                    <td className="p-2">
                      {r.valid ? (
                        <span className="text-emerald-700 font-bold">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Ready</span>
                          {r.problems.filter((p) => p.startsWith('Note:')).map((p) => (
                            <span key={p} className="block text-amber-700 font-semibold mt-0.5">{p}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={`font-bold ${r.duplicate ? 'text-amber-700' : 'text-rose-700'}`}>
                          {r.problems.join(' · ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={isImporting || !goodRows.length}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{isImporting ? 'Importing…' : `Import ${goodRows.length} ${kind}`}</span>
          </button>
        </div>
      )}

      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-semibold text-emerald-800">
          {summary.membersAdded} members added · {summary.skipped} skipped as already in the system · {summary.rejected} rejected
          {summary.leadersAdded > 0 && ` · ${summary.leadersAdded} leaders created from the Leader column — ${summary.leadersNeedingDetails} still need details`}
        </div>
      )}

      <IncompleteLeadersPanel
        leaders={newIncompleteLeaders}
        members={[...members, ...newIncompleteLeaders.map((leader) => ({
          id: leader.id,
          fullName: leader.fullName,
          phone: leader.contact,
          email: leader.email,
          role: 'Leader' as const,
          occupation: 'General',
          education: 'Not Specified',
          location: leader.location,
          church: leader.church,
          joinDate: leader.joinedDate,
          initials: leader.initials,
          serviceCount: 1,
          foundationClass: 7,
          status: 'General Member' as const,
        }))]}
        onSave={async (updated) => {
          const ok = await saveLeaderToSupabase(updated);
          if (!ok) return false;
          await syncLeaderAsMember(updated).catch(() => null);
          setNewIncompleteLeaders((current) => current.map((leader) => leader.id === updated.id ? updated : leader));
          onImported([], [updated]);
          return true;
        }}
      />

      {/* Email codes */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <p className="text-xs font-bold text-slate-500">Email attendance codes</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => emailCodes('members')}
            disabled={isEmailing}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">mail</span>
            <span>Email codes to all members</span>
          </button>
          <button
            onClick={() => emailCodes('leaders')}
            disabled={isEmailing}
            className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">mail</span>
            <span>Email codes to all leaders</span>
          </button>
        </div>
        {isEmailing && (
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-700 transition-all" style={{ width: `${emailProgress}%` }} />
          </div>
        )}
        {emailStatus && <p className="text-xs font-semibold text-slate-700">{emailStatus}</p>}
      </div>
    </div>
  );
};
