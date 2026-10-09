import React, { useMemo, useState } from 'react';
import { Leader, Member, AttendanceRecord } from '../types';
import { HierarchyAttendancePanel } from './HierarchyAttendancePanel';
import { useToast } from '../context/ToastContext';

/** Which kind of leader each role reports to: BSCT → Cell Leader → PCF Leader. */
const PARENT_TYPE: Record<string, string[]> = {
  'BSCT': ['Cell Leader'],
  'Cell Leader': ['PCF Leader', 'Church Coordinator'],
  'PCF Leader': ['Church Coordinator'],
};

interface Props {
  church: string;
  leaders: Leader[];
  members: Member[];
  attendance: AttendanceRecord[];
  canEdit: boolean;
  onUpdateLeader: (leader: Leader) => void | Promise<void>;
}

/** Church pastors arrange their leaders; everyone else sees the resulting totals. */
export const LeaderHierarchyManager: React.FC<Props> = ({ church, leaders, members, attendance, canEdit, onUpdateLeader }) => {
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const own = useMemo(
    () => leaders.filter(l => (l.church || '').toLowerCase() === church.toLowerCase()),
    [leaders, church]
  );

  const assign = async (leader: Leader, parentId: string) => {
    const parent = own.find(l => l.id === parentId);
    setSaving(leader.id);
    try {
      await onUpdateLeader({ ...leader, parentLeaderId: parent?.id || undefined, parentLeaderName: parent?.fullName || undefined });
      toast.showSuccess(parent ? `${leader.fullName} now reports to ${parent.fullName}.` : `${leader.fullName} no longer reports to anyone.`);
    } finally {
      setSaving(null);
    }
  };

  const groups: Array<[string, string]> = [['Cell Leader', 'Cell leaders → choose their PCF leader'], ['BSCT', 'Bible study class teachers → choose their cell leader'], ['PCF Leader', 'PCF leaders']];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow">{church}</p>
          <h1>Leader hierarchy</h1>
          <p className="dashboard-welcome-detail">PCF leader → cell leaders → Bible study class teachers. Totals add up through every level.</p>
        </div>
      </div>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map(([type, title]) => {
            const list = own.filter(l => l.leaderType === type);
            const parents = own.filter(l => (PARENT_TYPE[type] || []).includes(l.leaderType));
            return (
              <section key={type} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h3 className="font-headline text-sm text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500 mb-3">{list.length} registered</p>
                {list.length === 0 && <p className="text-xs text-slate-500">None yet.</p>}
                <div className="space-y-2">
                  {list.map(l => (
                    <div key={l.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs font-bold text-slate-900">{l.fullName}</p>
                      <p className="text-[11px] text-slate-500 mb-2">{l.cellOrPcfName || '—'}</p>
                      {PARENT_TYPE[type] && (
                        <select
                          aria-label={`Who ${l.fullName} reports to`}
                          disabled={saving === l.id}
                          value={l.parentLeaderId || ''}
                          onChange={e => assign(l, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                        >
                          <option value="">Not assigned</option>
                          {parents.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.leaderType})</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <HierarchyAttendancePanel members={members} leaders={leaders} attendance={attendance} churchScope={church} />
    </div>
  );
};
