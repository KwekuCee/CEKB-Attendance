import React, { useMemo, useState } from 'react';
import { AttendanceRecord, Leader, Member } from '../types';

interface Props {
  members: Member[];
  leaders: Leader[];
  attendanceRecords: AttendanceRecord[];
  isGroupView: boolean;
}

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const phoneKey = (p?: string) => {
  const d = (p || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
};
const TYPE_ORDER = ['Church Coordinator', 'PCF Leader', 'Cell Leader', 'BSCT'];

/** Branch comparison, leader structure and possible duplicate members. */
export const InsightsPanel: React.FC<Props> = ({ members, leaders, attendanceRecords, isGroupView }) => {
  const [tab, setTab] = useState<'compare' | 'structure' | 'duplicates'>(isGroupView ? 'compare' : 'structure');

  const comparison = useMemo(() => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const map = new Map<string, { members: number; checkins: number; firstTimers: number; leaders: number }>();
    const get = (c: string) => {
      const k = c || 'Unassigned';
      if (!map.has(k)) map.set(k, { members: 0, checkins: 0, firstTimers: 0, leaders: 0 });
      return map.get(k)!;
    };
    members.forEach(m => { const v = get(m.church); v.members++; if (m.status === 'First Timer') v.firstTimers++; });
    leaders.forEach(l => get(l.church).leaders++);
    attendanceRecords.forEach(r => { if ((r.date || '') >= since) get(r.church).checkins++; });
    return Array.from(map.entries()).sort((a, b) => b[1].checkins - a[1].checkins);
  }, [members, leaders, attendanceRecords]);
  const maxCheck = Math.max(1, ...comparison.map(([, v]) => v.checkins));

  const duplicates = useMemo(() => {
    const groups = new Map<string, Member[]>();
    members.forEach(m => {
      const keys = [`n:${norm(m.fullName)}|${norm(m.church)}`];
      const pk = phoneKey(m.phone);
      if (pk) keys.push(`p:${pk}`);
      keys.forEach(k => groups.set(k, [...(groups.get(k) || []), m]));
    });
    const seen = new Set<string>();
    return Array.from(groups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([k, list]) => ({ reason: k.startsWith('p:') ? 'Same phone number' : 'Same name', list }))
      .filter(g => { const id = g.list.map(m => m.id).sort().join(); if (seen.has(id)) return false; seen.add(id); return true; });
  }, [members]);

  const roots = leaders.filter(l => !l.parentLeaderId || !leaders.some(p => p.id === l.parentLeaderId))
    .sort((a, b) => TYPE_ORDER.indexOf(a.leaderType) - TYPE_ORDER.indexOf(b.leaderType));
  const memberCount = (l: Leader) => members.filter(m => m.invitedByLeaderId === l.id || (m.invitedBy || '').toLowerCase() === l.fullName.toLowerCase()).length;
  const renderNode = (l: Leader, depth = 0): React.ReactNode => (
    <div key={l.id} style={{ marginLeft: depth * 18 }} className="border-l-2 border-blue-100 pl-3 py-1">
      <div className="text-xs"><span className="font-bold text-slate-900">{l.fullName}</span> <span className="text-blue-700 font-semibold">· {l.leaderType}</span> <span className="text-slate-500">· {memberCount(l)} members{isGroupView ? ` · ${l.church}` : ''}</span></div>
      {depth < 6 && leaders.filter(c => c.parentLeaderId === l.id).map(c => renderNode(c, depth + 1))}
    </div>
  );

  const tabs = [
    ...(isGroupView ? [['compare', 'Branch comparison'] as const] : []),
    ['structure', 'Leader structure'] as const,
    ['duplicates', `Possible duplicates (${duplicates.length})`] as const,
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${tab === k ? 'bg-blue-700 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>{label}</button>
        ))}
      </div>
      <div className="p-4 sm:p-5 max-h-[420px] overflow-y-auto">
        {tab === 'compare' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Check-ins in the last 30 days, with members, first timers and leaders per branch.</p>
            {comparison.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-xs"><span className="font-bold text-slate-900">{name}</span><span className="text-slate-500">{v.members} members · {v.firstTimers} first timers · {v.leaders} leaders</span></div>
                <div className="flex items-center gap-2 mt-1"><div className="h-2.5 bg-blue-600 rounded-full" style={{ width: `${(v.checkins / maxCheck) * 100}%`, minWidth: 4 }} /><span className="text-xs font-bold text-blue-800">{v.checkins}</span></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'structure' && (roots.length ? roots.map(r => renderNode(r)) : <p className="text-xs text-slate-500">No leaders registered yet.</p>)}
        {tab === 'duplicates' && (
          duplicates.length === 0 ? <p className="text-xs text-slate-500">No possible duplicate members found.</p> : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">These records may be the same person. Check them in the members list and delete the extra one.</p>
              {duplicates.map((g, i) => (
                <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                  <div className="text-xs font-bold text-amber-800 mb-1">{g.reason}</div>
                  {g.list.map(m => <div key={m.id} className="text-xs text-slate-800">{m.fullName} · {m.phone || 'no phone'} · {m.church} · {m.id}</div>)}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
