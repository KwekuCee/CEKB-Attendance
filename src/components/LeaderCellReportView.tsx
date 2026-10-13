import React, { useState } from 'react';
import type { AuthSessionUser, Leader } from '../types';
import { Button } from './Button';
import {
  GRID_ROWS,
  EVANGELISM_FIELDS,
  submitCellReport,
  normalizeGhanaPhone,
  sanitizeAmount,
  type CellReportSubmission,
} from '../lib/cellReports';
import { useToast } from '../context/ToastContext';

interface LeaderCellReportViewProps {
  user: AuthSessionUser;
  leader?: Leader;
  reportCode: string;
  onSubmittedSuccess: () => void;
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

export const LeaderCellReportView: React.FC<LeaderCellReportViewProps> = ({
  user,
  leader,
  reportCode,
  onSubmittedSuccess,
}) => {
  const toast = useToast();
  const [venue, setVenue] = useState('');
  const [meetingDateTime, setMeetingDateTime] = useState('');
  const [outreachCentre, setOutreachCentre] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [grid, setGrid] = useState<GridState>(emptyGrid);
  const [evangelism, setEvangelism] = useState<Record<string, string>>(emptyEvangelism);
  const [soulsWon, setSoulsWon] = useState<SoulRow[]>(() => makeSouls(5));
  const [cellAttendance, setCellAttendance] = useState<AttendanceRow[]>(() => makeAttendance(10));
  const [sundayRegister, setSundayRegister] = useState<RegisterRow[]>(() => makeRegister(12));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedReceipt, setSubmittedReceipt] = useState<{ id: string; date: string } | null>(null);

  const setGridValue = (key: string, column: 'cell' | 'outreach', value: string) =>
    setGrid((prev) => ({ ...prev, [key]: { ...prev[key], [column]: value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');

    // Prepare grid with venue and meetingDateTime
    const fullGrid = {
      ...grid,
      venue: { cell: venue, outreach: '' },
      meetingDateTime: { cell: meetingDateTime, outreach: '' },
    };

    const submission: CellReportSubmission = {
      leaderName: leader?.fullName || user.name,
      cellName: leader?.cellOrPcfName || 'Cell Fellowship',
      outreachCentre,
      reportDate,
      reportGrid: fullGrid,
      evangelism,
      soulsWonList: soulsWon.filter((s) => s.name.trim() || s.contact.trim()),
      cellAttendance: cellAttendance.filter((a) => a.name.trim() || a.contact.trim()),
      sundayRegister: sundayRegister.filter((r) => r.present.trim() || r.absentee.trim()),
    };

    setIsSubmitting(true);
    const { data, error } = await submitCellReport(user.church, reportCode, submission, {
      leaderCode: leader?.leaderCode || leader?.id,
      phone: leader?.contact || user.phone,
    });
    setIsSubmitting(false);

    if (error || !data) {
      setSubmitError(error || 'Failed to submit report. Please try again.');
      return;
    }

    toast.showSuccess(
      'Cell Report Submitted!',
      `Weekly report for ${submission.cellName} has been submitted to ${user.church}.`
    );
    setSubmittedReceipt({ id: data.id || `rep-${Date.now()}`, date: reportDate });
  };

  if (submittedReceipt) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-xl mx-auto shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">check_circle</span>
        </div>
        <h2 className="text-xl font-headline font-bold text-slate-900">
          Weekly Report Submitted Successfully
        </h2>
        <p className="text-xs text-slate-600">
          Your cell report for <strong>{leader?.cellOrPcfName || 'Your Cell'}</strong> ({user.church}) has been recorded for the week of {submittedReceipt.date}.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
          Confirmation ID: {submittedReceipt.id}
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <Button onClick={onSubmittedSuccess}>
            <span className="material-symbols-outlined text-base">dashboard</span>
            <span>Return to Dashboard</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSubmittedReceipt(null);
              setGrid(emptyGrid());
              setEvangelism(emptyEvangelism());
              setSoulsWon(makeSouls(5));
            }}
          >
            Submit Another Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Weekly Ministry Report
          </span>
          <h2 className="text-xl md:text-2xl font-headline font-bold text-slate-900 tracking-tight">
            Cell & Outreach Meeting Sheet
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Branch: <strong className="text-slate-800">{user.church}</strong> • Access Code Verified • Leader: <strong className="text-slate-800">{user.name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">lock_open</span> Code Verified
          </span>
        </div>
      </div>

      {submitError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Basic Meeting Details */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          1. Meeting Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Report Date *</label>
            <input
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Cell Name</label>
            <input
              type="text"
              readOnly
              value={leader?.cellOrPcfName || 'Cell Fellowship'}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Meeting Venue</label>
            <input
              type="text"
              placeholder="e.g. Block A, Room 4"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Meeting Date & Time</label>
            <input
              type="text"
              placeholder="e.g. Saturday 5:00 PM"
              value={meetingDateTime}
              onChange={(e) => setMeetingDateTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>
      </div>

      {/* Main Report Sheet Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          2. Attendance & Program Totals
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 text-left">Metric / Row</th>
                <th className="py-2.5 px-3 text-center w-36">Cell Meeting</th>
                <th className="py-2.5 px-3 text-center w-36">Outreach Centre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {GRID_ROWS.filter((r) => r.key !== 'venue' && r.key !== 'meetingDateTime').map((r) => {
                const isHeading = r.type === 'heading';
                if (isHeading) {
                  return (
                    <tr key={r.key} className="bg-slate-100/60 font-bold text-slate-700">
                      <td colSpan={3} className="py-2 px-3 text-xs uppercase tracking-wider">
                        {r.label}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={r.key} className="hover:bg-slate-50/40">
                    <td className="py-2 px-3 text-slate-800 font-medium">{r.label}</td>
                    <td className="py-1.5 px-3">
                      <input
                        type={r.type === 'number' || r.type === 'money' ? 'number' : 'text'}
                        min={0}
                        placeholder="0"
                        value={grid[r.key]?.cell ?? ''}
                        onChange={(e) => setGridValue(r.key, 'cell', e.target.value)}
                        className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type={r.type === 'number' || r.type === 'money' ? 'number' : 'text'}
                        min={0}
                        placeholder="0"
                        value={grid[r.key]?.outreach ?? ''}
                        onChange={(e) => setGridValue(r.key, 'outreach', e.target.value)}
                        className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evangelism & Soulwinning Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="font-headline font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          3. Evangelism & Soulwinning (This Week)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {EVANGELISM_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block font-semibold text-slate-700 mb-1">{f.label}</label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.type === 'number' ? '0' : ''}
                value={evangelism[f.key] ?? ''}
                onChange={(e) =>
                  setEvangelism((prev) => ({
                    ...prev,
                    [f.key]: e.target.value,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Souls Won Contact List */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-headline font-bold text-sm text-slate-900">
            4. Souls Won List
          </h3>
          <Button
            type="button"
            variant="ghost"
            className="text-xs text-blue-600"
            onClick={() => setSoulsWon((prev) => [...prev, { name: '', contact: '' }])}
          >
            + Add Row
          </Button>
        </div>

        <div className="space-y-2">
          {soulsWon.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center text-xs">
              <span className="w-6 text-slate-400 font-mono text-center">{idx + 1}</span>
              <input
                type="text"
                placeholder="Soul's full name"
                value={row.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setSoulsWon((prev) => prev.map((s, i) => (i === idx ? { ...s, name: val } : s)));
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={row.contact}
                onChange={(e) => {
                  const val = e.target.value;
                  setSoulsWon((prev) => prev.map((s, i) => (i === idx ? { ...s, contact: val } : s)));
                }}
                className="w-44 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="py-2.5 px-6 font-bold text-sm">
          {isSubmitting ? (
            <span>Submitting Sheet…</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">send</span>
              <span>Submit Weekly Cell Report</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
