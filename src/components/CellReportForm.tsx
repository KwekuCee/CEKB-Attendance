import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Leader } from '../types';
import {
  GRID_ROWS,
  EVANGELISM_FIELDS,
  verifyReportCode,
  submitCellReport,
  normalizeGhanaPhone,
  sanitizeAmount,
  type CellReportSubmission,
} from '../lib/cellReports';

interface CellReportFormProps {
  /** Branch names registered on the platform. */
  churchOptions: string[];
  leaders: Leader[];
}

type GridState = Record<string, { cell: string; outreach: string }>;

interface SoulRow { name: string; contact: string }
interface AttendanceRow { name: string; contact: string; firstTimer: boolean; soulWon: boolean }
interface RegisterRow { present: string; contact: string; absentee: string; absenteeContact: string }

const emptyGrid = (): GridState =>
  GRID_ROWS.reduce((acc, row) => {
    acc[row.key] = { cell: '', outreach: '' };
    return acc;
  }, {} as GridState);

const emptyEvangelism = (): Record<string, string> =>
  EVANGELISM_FIELDS.reduce((acc, f) => {
    acc[f.key] = '';
    return acc;
  }, {} as Record<string, string>);

const makeSouls = (n: number): SoulRow[] => Array.from({ length: n }, () => ({ name: '', contact: '' }));
const makeAttendance = (n: number): AttendanceRow[] =>
  Array.from({ length: n }, () => ({ name: '', contact: '', firstTimer: false, soulWon: false }));
const makeRegister = (n: number): RegisterRow[] =>
  Array.from({ length: n }, () => ({ present: '', contact: '', absentee: '', absenteeContact: '' }));

const inputClass =
  'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition';

type PickedContact = { name: string; phone: string };
const contactPickerSupported = () =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

async function pickContacts(): Promise<PickedContact[] | null> {
  if (!contactPickerSupported()) return null;
  try {
    const list: any[] = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
    return list
      .map((c) => ({
        name: String(c?.name?.[0] || '').trim(),
        phone: normalizeGhanaPhone(String(c?.tel?.[0] || '')) || String(c?.tel?.[0] || '').trim(),
      }))
      .filter((c) => c.name || c.phone);
  } catch {
    return [];
  }
}

const PhonebookButton: React.FC<{ onPick: (c: PickedContact[]) => void }> = ({ onPick }) => {
  const [note, setNote] = useState('');
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={async () => {
          const res = await pickContacts();
          if (res === null) {
            setNote('Your browser cannot open the phonebook. Please type the names and numbers instead.');
            return;
          }
          setNote(res.length ? `Added ${res.length} contact${res.length > 1 ? 's' : ''}.` : '');
          if (res.length) onPick(res);
        }}
        className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer border border-blue-200 rounded-lg px-2.5 py-1.5 bg-blue-50"
      >
        <span className="material-symbols-outlined text-[16px]">contacts</span> Import from phonebook
      </button>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </span>
  );
};

/** Fills empty rows first, then appends new rows. */
function mergeContacts<T>(rows: T[], picked: PickedContact[], isEmpty: (r: T) => boolean, make: (c: PickedContact, base?: T) => T): T[] {
  const out = [...rows];
  for (const c of picked) {
    const idx = out.findIndex(isEmpty);
    if (idx >= 0) out[idx] = make(c, out[idx]);
    else out.push(make(c));
  }
  return out;
}

const phoneError = (v: string) => !!v.trim() && !normalizeGhanaPhone(v);
const phoneClass = (v: string) => (phoneError(v) ? ' border-rose-400 ring-1 ring-rose-300' : '');

const labelClass = 'block text-xs font-bold text-slate-600 mb-1.5';

/**
 * Public weekly cell report sheet.
 * A leader picks their branch, enters the access code their church administrator
 * gave them, then fills in the same sheet they use on paper.
 */
export const CellReportForm: React.FC<CellReportFormProps> = ({ churchOptions, leaders }) => {
  // --- gate ---
  const [church, setChurch] = useState('');
  const [code, setCode] = useState('');
  const [gateError, setGateError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState<'leader' | 'code'>('leader');
  const [leaderCode, setLeaderCode] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  // --- form ---
  const [leaderName, setLeaderName] = useState('');
  const [cellName, setCellName] = useState('');
  const [outreachCentre, setOutreachCentre] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [grid, setGrid] = useState<GridState>(emptyGrid);
  const [evangelism, setEvangelism] = useState<Record<string, string>>(emptyEvangelism);
  const [soulsWon, setSoulsWon] = useState<SoulRow[]>(() => makeSouls(5));
  const [cellAttendance, setCellAttendance] = useState<AttendanceRow[]>(() => makeAttendance(15));
  const [sundayRegister, setSundayRegister] = useState<RegisterRow[]>(() => makeRegister(20));

  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const churchLeaders = useMemo(
    () =>
      leaders
        .filter((l) => (l.church || '').trim().toLowerCase() === church.trim().toLowerCase())
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [leaders, church],
  );

  const handleVerify = async () => {
    if (isVerifying) return;
    setGateError('');
    if (mode === 'leader') {
      if (!leaderCode.trim()) return setGateError('Please enter your leader code (e.g. LDR-0001).');
      if (!normalizeGhanaPhone(leaderPhone)) return setGateError('Please enter the Ghana phone number you registered with.');
    } else {
      if (!church) return setGateError('Please choose your church branch.');
      if (!code.trim()) return setGateError('Please enter the access code from your church administrator.');
    }

    setIsVerifying(true);
    const { data, error } = await verifyReportCode(church, code.trim().toUpperCase(), loginInfo());
    setIsVerifying(false);
    if (error || !data?.ok) {
      setGateError(error || (mode === 'leader' ? 'That leader code and phone number do not match.' : 'That access code is not correct for this church.'));
      return;
    }
    if (data.leader) {
      setChurch(data.churchName);
      setLeaderName(data.leader.fullName);
      setCellName(data.leader.cellOrPcfName || '');
      setSignedIn(true);
    }
    setUnlocked(true);
  };

  const loginInfo = () =>
    mode === 'leader' ? { leaderCode: leaderCode.trim().toUpperCase(), phone: leaderPhone.trim() } : undefined;

  const setGridValue = (key: string, column: 'cell' | 'outreach', value: string) =>
    setGrid((prev) => ({ ...prev, [key]: { ...prev[key], [column]: value } }));

  const resetForm = () => {
    if (!signedIn) {
      setLeaderName('');
      setCellName('');
    }
    setOutreachCentre('');
    setReportDate(new Date().toISOString().slice(0, 10));
    setGrid(emptyGrid());
    setEvangelism(emptyEvangelism());
    setSoulsWon(makeSouls(5));
    setCellAttendance(makeAttendance(15));
    setSundayRegister(makeRegister(20));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError('');
    if (!leaderName.trim()) {
      setSubmitError('Please select the name of the leader submitting this report.');
      return;
    }

    const phones = [
      ...soulsWon.map((r) => r.contact),
      ...cellAttendance.map((r) => r.contact),
      ...sundayRegister.flatMap((r) => [r.contact, r.absenteeContact]),
    ];
    if (phones.some(phoneError)) {
      setSubmitError('Some phone numbers are not valid Ghana numbers (use 0XXXXXXXXX or +233XXXXXXXXX). They are outlined in red.');
      return;
    }
    const np = (v: string) => (v.trim() ? normalizeGhanaPhone(v) || '' : '');
    const payload: CellReportSubmission = {
      leaderName: leaderName.trim(),
      cellName: cellName.trim(),
      outreachCentre: outreachCentre.trim(),
      reportDate,
      reportGrid: grid,
      evangelism,
      soulsWonList: soulsWon.filter((r) => r.name.trim() || r.contact.trim()).map((r) => ({ ...r, contact: np(r.contact) })),
      cellAttendance: cellAttendance.filter((r) => r.name.trim() || r.contact.trim()).map((r) => ({ ...r, contact: np(r.contact) })),
      sundayRegister: sundayRegister.filter(
        (r) => r.present.trim() || r.contact.trim() || r.absentee.trim() || r.absenteeContact.trim(),
      ).map((r) => ({ ...r, contact: np(r.contact), absenteeContact: np(r.absenteeContact) })),
    };

    setIsSubmitting(true);
    const { data, error } = await submitCellReport(church, code.trim().toUpperCase(), payload, loginInfo());
    setIsSubmitting(false);
    if (error || !data?.ok) {
      setSubmitError(error || 'The report could not be saved. Please try again.');
      return;
    }
    setSubmitted(true);
  };

  // ---------------------------------------------------------------- gate view
  if (!unlocked) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
            <span className="material-symbols-outlined text-[24px]">assignment</span>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">Submit Weekly Cell Report</h3>
            <p className="text-xs text-slate-500">
              Sign in with your leader code, or use your branch access code.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          {([['leader', 'Leader sign-in'], ['code', 'Branch access code']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setGateError(''); }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'leader' ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Leader Code</label>
            <input
              value={leaderCode}
              onChange={(e) => setLeaderCode(e.target.value.toUpperCase())}
              placeholder="e.g. LDR-0001"
              className={`${inputClass} font-mono tracking-widest uppercase`}
            />
            <p className="text-xs text-slate-400 mt-1.5">It's printed on your leader QR pass.</p>
          </div>
          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              type="tel"
              value={leaderPhone}
              onChange={(e) => setLeaderPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="The number you registered with, e.g. 0241234567"
              className={inputClass}
            />
          </div>
        </div>
        ) : (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Church Branch</label>
            <select value={church} onChange={(e) => setChurch(e.target.value)} className={inputClass}>
              <option value="">Select your church branch…</option>
              {churchOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Access Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="e.g. K7M2QP"
              className={`${inputClass} font-mono tracking-[0.25em] uppercase text-center text-sm`}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Don't have a code? Ask your church administrator — they generate it in their dashboard settings.
            </p>
          </div>

          {gateError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3.5 py-2.5 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
              <span>{gateError}</span>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-sm shadow-blue-700/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">lock_open</span>
            {isVerifying ? 'Checking code…' : 'Open the report form'}
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ success view
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto bg-white border border-blue-200 rounded-2xl p-8 shadow-sm text-center space-y-5"
      >
        <div className="w-16 h-16 bg-blue-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-700/20">
          <span className="material-symbols-outlined text-[36px]">assignment_turned_in</span>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">Report submitted</h3>
          <p className="text-xs text-slate-500 mt-1.5">
            Thank you, {leaderName}. Your {church} administrator and the group pastor can now see this week's
            report in their dashboard.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setSubmitted(false);
          }}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-sm shadow-blue-700/20 active:scale-98 cursor-pointer"
        >
          Submit another report
        </button>
      </motion.div>
    );
  }

  // --------------------------------------------------------------- form view
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
            <span className="material-symbols-outlined text-[24px]">assignment</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-slate-900">Weekly Cell Report</h3>
            <p className="text-xs text-slate-500 truncate">{church} • fill in every section that applies</p>
          </div>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Code verified
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Church</label>
            <div className="relative">
              <input value={church} readOnly disabled aria-readonly className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed pr-8`} />
              <span className="material-symbols-outlined text-[16px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2">lock</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Name of Leader</label>
            <select
              value={leaderName}
              onChange={(e) => {
                setLeaderName(e.target.value);
                const l = churchLeaders.find((x) => x.fullName === e.target.value);
                if (l?.cellOrPcfName) setCellName(l.cellOrPcfName);
              }}
              className={inputClass}
            >
              <option value="">Select your name…</option>
              {churchLeaders.map((l) => (
                <option key={l.id} value={l.fullName}>
                  {l.fullName} — {l.leaderType}
                </option>
              ))}
            </select>
            {churchLeaders.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                No leaders are registered at {church} yet. Register as a leader first, then submit this report.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Cell / PCF Name</label>
            <input
              value={cellName}
              onChange={(e) => setCellName(e.target.value)}
              placeholder="Filled in when you pick your name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Outreach Centre</label>
            <input
              value={outreachCentre}
              onChange={(e) => setOutreachCentre(e.target.value)}
              placeholder="Name of the outreach centre"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Week / Report Date</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Report grid */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="font-display text-sm font-bold text-slate-900">Report</h4>
          <p className="text-xs text-slate-500">Fill in the cell meeting column and the outreach centre column.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="text-left font-bold text-slate-500 px-4 py-2.5 w-[38%]">Item</th>
                <th className="text-left font-bold text-slate-500 px-4 py-2.5">Cell Meeting</th>
                <th className="text-left font-bold text-slate-500 px-4 py-2.5">Outreach Centre</th>
              </tr>
            </thead>
            <tbody>
              {GRID_ROWS.map((row) =>
                row.type === 'heading' ? (
                  <tr key={row.key} className="bg-blue-50/60 border-b border-blue-100">
                    <td colSpan={3} className="px-4 py-2 font-display font-bold text-blue-800 text-xs uppercase tracking-wide">
                      {row.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={row.key} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-semibold text-slate-700">{row.label}</td>
                    {(['cell', 'outreach'] as const).map((col) => (
                      <td key={col} className="px-2 py-1.5">
                        {row.type === 'money' ? (
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">GH₵</span>
                            <input
                              inputMode="decimal"
                              value={grid[row.key]?.[col] ?? ''}
                              onChange={(e) => setGridValue(row.key, col, sanitizeAmount(e.target.value, true))}
                              placeholder="0.00"
                              className={`${inputClass} pl-11`}
                            />
                          </div>
                        ) : (
                          <input
                            type={row.type === 'datetime' ? 'datetime-local' : 'text'}
                            inputMode={row.type === 'number' ? 'numeric' : undefined}
                            value={grid[row.key]?.[col] ?? ''}
                            onChange={(e) =>
                              setGridValue(row.key, col, row.type === 'number' ? sanitizeAmount(e.target.value) : e.target.value)
                            }
                            placeholder={row.type === 'number' ? '0' : undefined}
                            className={inputClass}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evangelism */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h4 className="font-display text-sm font-bold text-slate-900">Evangelism & Soulwinning</h4>
          <p className="text-xs text-slate-500">This week's outreach activity.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EVANGELISM_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labelClass}>{f.label}</label>
              <input
                inputMode={f.type === 'number' ? 'numeric' : undefined}
                value={evangelism[f.key] ?? ''}
                onChange={(e) =>
                  setEvangelism((prev) => ({
                    ...prev,
                    [f.key]: f.type === 'number' ? sanitizeAmount(e.target.value) : e.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-slate-600">Names & contacts of those led to Christ</p>
            <PhonebookButton
              onPick={(c) =>
                setSoulsWon((prev) =>
                  mergeContacts(prev, c, (r) => !r.name.trim() && !r.contact.trim(), (x) => ({ name: x.name, contact: x.phone })),
                )
              }
            />
          </div>
          {soulsWon.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row.name}
                onChange={(e) =>
                  setSoulsWon((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="Full name"
                className={inputClass}
              />
              <input
                value={row.contact}
                onChange={(e) =>
                  setSoulsWon((prev) => prev.map((r, idx) => (idx === i ? { ...r, contact: e.target.value } : r)))
                }
                placeholder="024XXXXXXX"
                type="tel"
                className={inputClass + phoneClass(row.contact)}
              />
              <button
                onClick={() => setSoulsWon((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                title="Remove row"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
          <button
            onClick={() => setSoulsWon((prev) => [...prev, { name: '', contact: '' }])}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Add a name
          </button>
        </div>
      </div>

      {/* Cell attendance sheet */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="font-display text-sm font-bold text-slate-900">Cell Attendance Sheet</h4>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-500">Tick first timers and souls won where they apply.</p>
            <PhonebookButton
              onPick={(c) =>
                setCellAttendance((prev) =>
                  mergeContacts(prev, c, (r) => !r.name.trim() && !r.contact.trim(), (x, b) => ({
                    firstTimer: b?.firstTimer ?? false,
                    soulWon: b?.soulWon ?? false,
                    name: x.name,
                    contact: x.phone,
                  })),
                )
              }
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left font-bold text-slate-500 px-4 py-2.5 w-10">#</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Name</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Contact</th>
                <th className="text-center font-bold text-slate-500 px-2 py-2.5 w-24">First timer</th>
                <th className="text-center font-bold text-slate-500 px-2 py-2.5 w-24">Soul won</th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {cellAttendance.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-1.5 font-mono text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.name}
                      onChange={(e) =>
                        setCellAttendance((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.contact}
                      onChange={(e) =>
                        setCellAttendance((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, contact: e.target.value } : r)),
                        )
                      }
                      type="tel"
                      placeholder="024XXXXXXX"
                      className={inputClass + phoneClass(row.contact)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.firstTimer}
                      onChange={(e) =>
                        setCellAttendance((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, firstTimer: e.target.checked } : r)),
                        )
                      }
                      className="w-4 h-4 accent-blue-700 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.soulWon}
                      onChange={(e) =>
                        setCellAttendance((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, soulWon: e.target.checked } : r)),
                        )
                      }
                      className="w-4 h-4 accent-blue-700 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => setCellAttendance((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-rose-600 cursor-pointer"
                      title="Remove row"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={() =>
              setCellAttendance((prev) => [...prev, { name: '', contact: '', firstTimer: false, soulWon: false }])
            }
            className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Add a row
          </button>
        </div>
      </div>

      {/* Sunday register */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="font-display text-sm font-bold text-slate-900">Sunday Service Register</h4>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-500">Members present and absentees for the Sunday service.</p>
            <PhonebookButton
              onPick={(c) =>
                setSundayRegister((prev) =>
                  mergeContacts(prev, c, (r) => !r.present.trim() && !r.contact.trim(), (x, b) => ({
                    absentee: b?.absentee ?? '',
                    absenteeContact: b?.absenteeContact ?? '',
                    present: x.name,
                    contact: x.phone,
                  })),
                )
              }
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left font-bold text-slate-500 px-4 py-2.5 w-10">#</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Members present</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Contact</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Absentees</th>
                <th className="text-left font-bold text-slate-500 px-2 py-2.5">Absentee contact</th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {sundayRegister.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-1.5 font-mono text-slate-400">{i + 1}</td>
                  {(['present', 'contact', 'absentee', 'absenteeContact'] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        value={row[field]}
                        onChange={(e) =>
                          setSundayRegister((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, [field]: e.target.value } : r)),
                          )
                        }
                        type={field === 'contact' || field === 'absenteeContact' ? 'tel' : 'text'}
                        className={
                          inputClass +
                          (field === 'contact' || field === 'absenteeContact' ? phoneClass(row[field]) : '')
                        }
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => setSundayRegister((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-rose-600 cursor-pointer"
                      title="Remove row"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={() =>
              setSundayRegister((prev) => [...prev, { present: '', contact: '', absentee: '', absenteeContact: '' }])
            }
            className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Add a row
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
        {submitError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
            <span>{submitError}</span>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-sm shadow-blue-700/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          {isSubmitting ? 'Submitting report…' : 'Submit this week\u2019s report'}
        </button>
        <p className="text-xs text-slate-400 text-center">
          Your report goes to your church administrator and the group pastor.
        </p>
      </div>
    </div>
  );
};
