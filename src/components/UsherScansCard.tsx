import React, { useMemo } from 'react';
import { AttendanceRecord } from '../types';

const SUFFIX = ' (QR Scanner)';

/** Counts QR check-ins per scanner name from the branch's attendance records. */
export const UsherScansCard: React.FC<{ attendance: AttendanceRecord[]; church?: string }> = ({ attendance, church }) => {
  const rows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const map = new Map<string, { name: string; branch: string; today: number; week: number }>();
    for (const a of attendance || []) {
      if (!a?.verifiedBy?.endsWith(SUFFIX)) continue;
      if (church && (a.church || '').toLowerCase() !== church.toLowerCase()) continue;
      const d = (a.date || '').slice(0, 10);
      if (d < weekAgo) continue;
      const name = a.verifiedBy.slice(0, -SUFFIX.length);
      const key = `${name}|${a.church}`;
      const r = map.get(key) || { name, branch: a.church, today: 0, week: 0 };
      r.week++;
      if (d === today) r.today++;
      map.set(key, r);
    }
    return [...map.values()].sort((x, y) => y.week - x.week);
  }, [attendance, church]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-6">
      <h3 className="font-headline font-bold text-sm text-slate-900">Ushers' scans</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">People each usher checked in with the scanner.</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">No scanner check-ins in the last 7 days.</p>
      ) : (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500"><th className="py-1">Usher</th>{!church && <th>Branch</th>}<th className="text-right">Today</th><th className="text-right">Last 7 days</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.name}|${r.branch}`} className="border-t border-slate-100">
                <td className="py-2 font-bold text-slate-900">{r.name}</td>
                {!church && <td>{r.branch}</td>}
                <td className="text-right font-bold">{r.today}</td>
                <td className="text-right">{r.week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
