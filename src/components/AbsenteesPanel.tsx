import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, Leader, Member } from '../types';
import { AbsenceRecord, fetchAbsenceRecords, saveAbsenceFollowUp } from '../lib/supabaseService';
import { useToast } from '../context/ToastContext';

interface AbsenteesPanelProps {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  serviceTypes: string[];
  /** When set, only this church's people are shown (church admin view). */
  churchName?: string;
  /** Superadmin sees every church and can read follow-up reports across branches. */
  isGroupView?: boolean;
  recordedBy?: string;
  leaders?: Leader[];
}

const REASONS = [
  'Travelled',
  'Unwell / Hospital',
  'Work / School commitment',
  'Family commitment',
  'Relocated',
  'No response yet',
  'Other'
];

/** Shows who missed a service and lets the admin record the follow-up reason. */
export const AbsenteesPanel: React.FC<AbsenteesPanelProps> = ({
  members,
  attendanceRecords,
  serviceTypes,
  churchName,
  isGroupView = false,
  recordedBy,
  leaders = []
}) => {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceType, setServiceType] = useState(serviceTypes[0] || 'Sunday Service');
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reason: string; note: string }>>({});

  useEffect(() => {
    fetchAbsenceRecords().then(setAbsences);
  }, []);

  const scopedMembers = useMemo(
    () =>
      churchName
        ? members.filter((m) => (m.church || '').toLowerCase() === churchName.toLowerCase())
        : members,
    [members, churchName]
  );

  const presentIds = useMemo(() => {
    const set = new Set<string>();
    attendanceRecords.forEach((r) => {
      if (r.date === serviceDate && r.serviceType === serviceType) {
        if (!churchName || (r.church || '').toLowerCase() === churchName.toLowerCase()) {
          set.add(r.memberId);
        }
      }
    });
    return set;
  }, [attendanceRecords, serviceDate, serviceType, churchName]);

  const absentMembers = useMemo(
    () => scopedMembers.filter((m) => !presentIds.has(m.id)),
    [scopedMembers, presentIds]
  );

  const [leaderFilter, setLeaderFilter] = useState('');
  const leaderFor = (m: Member) =>
    leaders.find((l) => (m.invitedByLeaderId && l.id === m.invitedByLeaderId) || (m.invitedBy && l.fullName.toLowerCase() === m.invitedBy.toLowerCase()));
  const waLink = (phone: string, text: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    const intl = digits.startsWith('0') ? '233' + digits.slice(1) : digits;
    return intl ? `https://wa.me/${intl}?text=${encodeURIComponent(text)}` : '';
  };
  const visibleAbsent = leaderFilter
    ? absentMembers.filter((m) => (m.invitedBy || 'No leader yet') === leaderFilter)
    : absentMembers;
  const leaderNames = Array.from(new Set(absentMembers.map((m) => m.invitedBy || 'No leader yet'))).sort();

  const savedFor = (memberId: string) =>
    absences.find(
      (a) => a.memberId === memberId && a.serviceType === serviceType && a.serviceDate === serviceDate
    );

  const handleSave = async (member: Member) => {
    const draft = drafts[member.id] || { reason: '', note: '' };
    if (!draft.reason) {
      toast.showError('Pick a reason first.');
      return;
    }
    setSavingId(member.id);
    const ok = await saveAbsenceFollowUp({
      memberId: member.id,
      memberName: member.fullName,
      church: member.church,
      serviceType,
      serviceDate,
      reason: draft.reason,
      note: draft.note,
      recordedBy
    });
    setSavingId(null);
    if (ok) {
      toast.showSuccess(`Reason saved for ${member.fullName}.`);
      setAbsences(await fetchAbsenceRecords());
    } else {
      toast.showError('Could not save the reason. Please try again.');
    }
  };

  const reportRows = useMemo(
    () =>
      absences.filter(
        (a) => !churchName || (a.church || '').toLowerCase() === churchName.toLowerCase()
      ),
    [absences, churchName]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h3 className="font-headline font-bold text-sm text-slate-900">Absent for a service</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isGroupView
              ? 'Who missed a service across all churches, and the follow-up reasons admins recorded.'
              : 'Who missed this service. Add the reason after your follow-up call.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            aria-label="Service date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600"
          />
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            aria-label="Service"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600"
          >
            {serviceTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center gap-6">
        <div>
          <div className="text-xs text-slate-500 font-semibold">Absent</div>
          <div className="font-stat text-2xl font-extrabold text-slate-900">{absentMembers.length}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 font-semibold">Present</div>
          <div className="font-stat text-2xl font-extrabold text-blue-700">{presentIds.size}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 font-semibold">Reasons recorded</div>
          <div className="font-stat text-2xl font-extrabold text-slate-900">
            {reportRows.filter((a) => a.serviceDate === serviceDate && a.serviceType === serviceType).length}
          </div>
        </div>
      </div>

      {leaderNames.length > 1 && (
        <div className="px-4 sm:px-5 py-2 border-b border-slate-100 flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Leader:</span>
          <select value={leaderFilter} onChange={(e) => setLeaderFilter(e.target.value)} aria-label="Filter absentees by leader" className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold">
            <option value="">All leaders</option>
            {leaderNames.map((n) => <option key={n} value={n}>{n} ({absentMembers.filter((m) => (m.invitedBy || 'No leader yet') === n).length})</option>)}
          </select>
        </div>
      )}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
        {visibleAbsent.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Everyone on record was present for this service.
          </div>
        ) : (
          visibleAbsent.map((member) => {
            const leader = leaderFor(member);
            const leaderMsg = waLink(leader?.contact || '', `Hello ${leader?.fullName || ''}, ${member.fullName} (${member.phone || 'no phone'}) missed ${serviceType} on ${serviceDate}. Please follow up and let the admin know the reason. — CE Korle Bu`);
            const memberMsg = waLink(member.phone || '', `Hello ${member.fullName}, we missed you at ${serviceType} on ${serviceDate}. We hope all is well! — CE Korle Bu`);
            const isFirstTimer = member.status === 'First Timer';
            const saved = savedFor(member.id);
            const draft = drafts[member.id] || { reason: saved?.reason || '', note: saved?.note || '' };
            return (
              <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate">{member.fullName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {member.church} · {member.invitedBy || 'No leader yet'}
                  </div>
                  {isFirstTimer && (
                    <div className="flex flex-wrap gap-1 mt-1 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">First timer</span>
                      <span className={`px-2 py-0.5 rounded-full ${(member.serviceCount || 0) >= 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Services {Math.min(member.serviceCount || 0, 2)}/2</span>
                      <span className={`px-2 py-0.5 rounded-full ${(member.foundationClass || 0) >= 7 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Foundation {member.foundationClass || 0}/7</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1 text-[11px] font-bold">
                    {leaderMsg && <a href={leaderMsg} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Send to leader (WhatsApp)</a>}
                    {memberMsg && <a href={memberMsg} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">Message member</a>}
                    {member.phone && <a href={`tel:${member.phone}`} className="text-slate-600 hover:underline">Call</a>}
                  </div>
                  {saved && (
                    <div className="text-xs text-emerald-700 font-semibold mt-1">
                      Recorded: {saved.reason}
                      {saved.note ? ` — ${saved.note}` : ''}
                    </div>
                  )}
                </div>

                {!isGroupView && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={draft.reason}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [member.id]: { ...draft, reason: e.target.value } }))
                      }
                      aria-label={`Reason for ${member.fullName}`}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                    >
                      <option value="">Pick a reason</option>
                      {REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [member.id]: { ...draft, note: e.target.value } }))
                      }
                      placeholder="Short note (optional)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 w-44"
                    />
                    <button
                      onClick={() => handleSave(member)}
                      disabled={savingId === member.id}
                      className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                    >
                      {savingId === member.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isGroupView && reportRows.length > 0 && (
        <div className="border-t border-slate-100 p-4">
          <h4 className="font-bold text-xs text-slate-900 mb-2">Follow-up reports from churches</h4>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {reportRows.slice(0, 40).map((a) => (
              <div key={a.id} className="text-xs text-slate-700 flex flex-wrap gap-x-2">
                <span className="font-bold text-slate-900">{a.memberName}</span>
                <span className="text-slate-400">{a.church}</span>
                <span>· {a.serviceType} · {a.serviceDate}</span>
                <span className="font-semibold text-blue-800">{a.reason}</span>
                {a.note && <span className="text-slate-500">({a.note})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
