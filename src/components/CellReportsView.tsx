import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { AuthSessionUser, UserProfile, CellReport, ViewType } from '../types';
import { fetchCellReports, GRID_ROWS, EVANGELISM_FIELDS } from '../lib/cellReports';

interface CellReportsViewProps {
  user: UserProfile | AuthSessionUser;
  onNavigate: (view: ViewType) => void;
}

const card = 'bg-white border border-slate-200/90 rounded-2xl shadow-sm';
const inputClass =
  'bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens the printable version of one report so it can be saved as a PDF. */
function printReport(report: CellReport) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = GRID_ROWS.map(
    r =>
      `<tr><td>${r.label}</td><td>${report.reportGrid?.[r.key]?.cell ?? ''}</td><td>${
        report.reportGrid?.[r.key]?.outreach ?? ''
      }</td></tr>`,
  ).join('');
  const evangelism = EVANGELISM_FIELDS.map(
    f => `<tr><td>${f.label}</td><td>${report.evangelism?.[f.key] ?? ''}</td></tr>`,
  ).join('');
  const list = (title: string, items: Array<Record<string, any>>, cols: Array<[string, string]>) => {
    const filled = items.filter(row => cols.some(([k]) => String(row?.[k] ?? '').trim() && row[k] !== false));
    if (!filled.length) return '';
    return `<h3>${title}</h3><table><thead><tr>${cols
      .map(([, label]) => `<th>${label}</th>`)
      .join('')}</tr></thead><tbody>${filled
      .map(
        row =>
          `<tr>${cols
            .map(([k]) => `<td>${typeof row[k] === 'boolean' ? (row[k] ? 'Yes' : '') : String(row[k] ?? '')}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>`;
  };

  win.document.write(`<!doctype html><html><head><title>Cell Report — ${report.leaderName}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
  h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;color:#1d4ed8}
  h3{font-size:13px;margin:14px 0 6px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:11px;text-align:left}
  th{background:#eff6ff}</style></head><body>
  <h1>CEKB Group — Weekly Cell Report</h1>
  <p style="font-size:12px">${report.church} • ${report.leaderName} • ${report.cellName || '—'} • ${report.reportDate}</p>
  <h2>Report sheet</h2>
  <table><thead><tr><th></th><th>Cell meeting</th><th>Outreach centre</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Evangelism &amp; soulwinning</h2><table><tbody>${evangelism}</tbody></table>
  ${list('Souls won', report.soulsWonList || [], [['name', 'Name'], ['contact', 'Contact']])}
  ${list('Cell attendance', report.cellAttendance || [], [['name', 'Name'], ['contact', 'Contact'], ['firstTimer', 'First timer'], ['soulWon', 'Soul won']])}
  ${list('Sunday service register', report.sundayRegister || [], [['present', 'Members present'], ['contact', 'Contact'], ['absentee', 'Absentees'], ['absenteeContact', 'Absentee contact']])}
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/**
 * Weekly cell reports submitted by leaders.
 * Branch admins only ever receive their own branch's reports (enforced server
 * side); the group account sees every branch and can filter.
 */
export const CellReportsView: React.FC<CellReportsViewProps> = ({ user, onNavigate }) => {
  const isSuperadmin = user.role === 'Superadmin';
  const [reports, setReports] = useState<CellReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [churchFilter, setChurchFilter] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [open, setOpen] = useState<CellReport | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await fetchCellReports();
      if (!alive) return;
      setReports(rows);
      setIsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const churches = useMemo(
    () => Array.from(new Set(reports.map(r => r.church).filter(Boolean))).sort(),
    [reports],
  );

  const filtered = useMemo(
    () =>
      reports.filter(r => {
        if (churchFilter && r.church.toLowerCase() !== churchFilter.toLowerCase()) return false;
        if (leaderFilter && !r.leaderName.toLowerCase().includes(leaderFilter.toLowerCase())) return false;
        if (dateFilter && r.reportDate !== dateFilter) return false;
        return true;
      }),
    [reports, churchFilter, leaderFilter, dateFilter],
  );

  const handleExportList = () => {
    downloadCsv(`CEKB_Cell_Reports_${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Church', 'Leader', 'Cell name', 'Outreach centre', 'Report date', 'Attendance', 'First timers', 'Souls won', 'Offering', 'Submitted'],
      ...filtered.map(r => [
        r.church,
        r.leaderName,
        r.cellName,
        r.outreachCentre,
        r.reportDate,
        String(r.totalAttendance),
        String(r.totalFirstTimers),
        String(r.totalSoulsWon),
        String(r.totalOffering),
        r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
      ]),
    ]);
  };

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          attendance: acc.attendance + r.totalAttendance,
          firstTimers: acc.firstTimers + r.totalFirstTimers,
          souls: acc.souls + r.totalSoulsWon,
          offering: acc.offering + r.totalOffering,
        }),
        { attendance: 0, firstTimers: 0, souls: 0, offering: 0 },
      ),
    [filtered],
  );

  const weekly = useMemo(() => {
    const map = new Map<string, { attendance: number; souls: number; reports: number }>();
    filtered.forEach(r => {
      if (!r.reportDate) return;
      const d = new Date(r.reportDate.slice(0, 10) + 'T00:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = d.toISOString().slice(0, 10);
      const v = map.get(k) || { attendance: 0, souls: 0, reports: 0 };
      v.attendance += r.totalAttendance; v.souls += r.totalSoulsWon; v.reports += 1;
      map.set(k, v);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  }, [filtered]);
  const maxWeek = Math.max(1, ...weekly.map(([, v]) => v.attendance));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-extrabold text-xl md:text-2xl text-slate-900">Weekly Cell Reports</h2>
          <p className="text-xs text-slate-500">
            {isSuperadmin
              ? 'Every report submitted by leaders across the group.'
              : `Reports submitted by leaders of ${user.church || 'your branch'}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportList}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Export list
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span> Dashboard
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Reports', value: filtered.length, icon: 'assignment' },
          { label: 'Total attendance', value: totals.attendance, icon: 'groups' },
          { label: 'First timers', value: totals.firstTimers, icon: 'person_add' },
          { label: 'Souls won', value: totals.souls, icon: 'volunteer_activism' },
          { label: 'Offering', value: totals.offering, icon: 'payments' },
        ].map(s => (
          <div key={s.label} className={`${card} p-4`}>
            <div className="flex items-center gap-2 text-blue-700">
              <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
              <span className="text-xs font-bold text-slate-500">{s.label}</span>
            </div>
            <p className="font-display font-extrabold text-xl text-slate-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {weekly.length > 1 && (
        <div className={`${card} p-4`}>
          <h3 className="font-bold text-sm text-slate-900">Weekly trend</h3>
          <p className="text-xs text-slate-500 mb-3">Cell attendance per week (souls won in green). Follows the filters above.</p>
          <div className="flex items-end gap-2 h-40">
            {weekly.map(([wk, v]) => (
              <div key={wk} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${v.reports} reports · ${v.attendance} attendance · ${v.souls} souls`}>
                <span className="text-[10px] font-bold text-slate-700">{v.attendance}</span>
                <div className="w-full flex items-end gap-0.5 h-full">
                  <div className="flex-1 bg-blue-600 rounded-t" style={{ height: `${(v.attendance / maxWeek) * 100}%` }} />
                  <div className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${(v.souls / maxWeek) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-500">{new Date(wk + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${card} p-4 flex flex-wrap gap-2 items-center`}>
        {isSuperadmin && (
          <select value={churchFilter} onChange={e => setChurchFilter(e.target.value)} className={inputClass}>
            <option value="">All branches</option>
            {churches.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <input
          value={leaderFilter}
          onChange={e => setLeaderFilter(e.target.value)}
          placeholder="Search leader name"
          className={inputClass}
        />
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={inputClass} />
        {(churchFilter || leaderFilter || dateFilter) && (
          <button
            onClick={() => {
              setChurchFilter('');
              setLeaderFilter('');
              setDateFilter('');
            }}
            className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['Branch', 'Leader', 'Cell', 'Date', 'Attendance', 'First timers', 'Souls won', 'Offering', ''].map(h => (
                <th key={h} className="text-left font-bold px-4 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Loading reports…
                </td>
              </tr>
            )}
            {!isLoading && !filtered.length && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No cell reports yet.
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{r.church}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.leaderName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.cellName || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.reportDate}</td>
                <td className="px-4 py-3">{r.totalAttendance}</td>
                <td className="px-4 py-3">{r.totalFirstTimers}</td>
                <td className="px-4 py-3">{r.totalSoulsWon}</td>
                <td className="px-4 py-3">{r.totalOffering}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setOpen(r)}
                    className="font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Read-only report viewer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl w-full max-w-4xl my-8 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div>
                <h3 className="font-display font-extrabold text-lg text-slate-900">Weekly Cell Report</h3>
                <p className="text-xs text-slate-500">
                  {open.church} • {open.leaderName} • {open.cellName || '—'} • {open.reportDate}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printReport(open)}
                  className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span> PDF
                </button>
                <button
                  onClick={() => setOpen(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer text-slate-500"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6 text-xs">
              <div>
                <p className="font-bold text-slate-600 mb-2">Report sheet</p>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full">
                    <thead className="bg-blue-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold"></th>
                        <th className="text-left px-3 py-2 font-bold">Cell meeting</th>
                        <th className="text-left px-3 py-2 font-bold">Outreach centre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GRID_ROWS.map(row => (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td>
                          <td className="px-3 py-2">{open.reportGrid?.[row.key]?.cell || '—'}</td>
                          <td className="px-3 py-2">{open.reportGrid?.[row.key]?.outreach || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-600 mb-2">Evangelism &amp; soulwinning</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EVANGELISM_FIELDS.map(f => (
                    <div key={f.key} className="flex justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2">
                      <span className="text-slate-600">{f.label}</span>
                      <span className="font-bold text-slate-900">{open.evangelism?.[f.key] || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {[
                { title: 'Souls won', rows: open.soulsWonList || [], cols: [['name', 'Name'], ['contact', 'Contact']] as Array<[string, string]> },
                {
                  title: 'Cell attendance',
                  rows: open.cellAttendance || [],
                  cols: [['name', 'Name'], ['contact', 'Contact'], ['firstTimer', 'First timer'], ['soulWon', 'Soul won']] as Array<[string, string]>,
                },
                {
                  title: 'Sunday service register',
                  rows: open.sundayRegister || [],
                  cols: [['present', 'Members present'], ['contact', 'Contact'], ['absentee', 'Absentees'], ['absenteeContact', 'Absentee contact']] as Array<[string, string]>,
                },
              ].map(section => {
                const filledRows = section.rows.filter(row =>
                  section.cols.some(([k]) => typeof row?.[k] === 'boolean' ? row[k] : String(row?.[k] ?? '').trim()),
                );
                if (!filledRows.length) return null;
                return (
                  <div key={section.title}>
                    <p className="font-bold text-slate-600 mb-2">{section.title}</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            {section.cols.map(([, label]) => (
                              <th key={label} className="text-left px-3 py-2 font-bold whitespace-nowrap">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filledRows.map((row, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              {section.cols.map(([k]) => (
                                <td key={k} className="px-3 py-2">
                                  {typeof row[k] === 'boolean' ? (row[k] ? 'Yes' : '—') : String(row[k] ?? '') || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
