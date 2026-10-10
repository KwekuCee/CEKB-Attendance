import React, { useEffect, useMemo, useState } from 'react';
import { Leader, Member, AttendanceRecord, AuthSessionUser } from '../types';
import { buildLeaderAttendanceTree, flattenLeaderNode } from '../utils/analyticsUtils';
import { Button } from './Button';
import { DashboardWalkthrough, hasSeenWalkthrough } from './DashboardWalkthrough';

interface Props {
  user: AuthSessionUser;
  leaders: Leader[];
  members: Member[];
  attendance: AttendanceRecord[];
  onLogout: () => void;
}

/** A leader's own view: their members and the totals for everyone under them. */
export const LeaderHome: React.FC<Props> = ({ user, leaders, members, attendance, onLogout }) => {
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    if (!hasSeenWalkthrough(user)) {
      setShowWalkthrough(true);
    }
  }, [user.email, user.name, user.role]);

  const same = (v?: string) => (v || '').toLowerCase() === (user.church || '').toLowerCase();
  const scoped = useMemo(() => ({
    leaders: leaders.filter(l => same(l.church)),
    members: members.filter(m => same(m.church)),
    attendance: attendance.filter(a => same(a.church)),
  }), [leaders, members, attendance, user.church]);

  const me = scoped.leaders.find(l => (l.email || '').toLowerCase() === (user.email || '').toLowerCase())
    || scoped.leaders.find(l => (l.fullName || '').toLowerCase() === (user.name || '').toLowerCase());
  const tree = useMemo(() => buildLeaderAttendanceTree(scoped.members, scoped.leaders, scoped.attendance), [scoped]);
  const node = me ? tree.nodes.find(n => n.id === me.id) : undefined;
  const below = node ? flattenLeaderNode(node) : [];
  const myMembers = me ? scoped.members.filter(m => m.invitedByLeaderId === me.id || (m.invitedBy || '').toLowerCase() === me.fullName.toLowerCase()) : [];

  return (
    <div className="dashboard-shell min-h-screen p-4 md:p-8">
      <div className="dashboard-workspace max-w-5xl mx-auto rounded-3xl p-4 md:p-8 space-y-6">
        <div className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">{user.church}</p>
            <h1>Welcome, {user.name}</h1>
            <p className="dashboard-welcome-detail">{me ? `${me.leaderType} · ${me.cellOrPcfName || ''}` : 'Leader account'}</p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <Button variant="secondary" onClick={() => setShowWalkthrough(true)}>
              <span className="material-symbols-outlined">school</span>
              <span>Watch Step-by-Step Walkthrough</span>
            </Button>
            <div className="dashboard-welcome-actions flex flex-wrap items-center gap-2">
              <Button onClick={() => { window.location.href = '/cell-report'; }}>
                <span className="material-symbols-outlined">assignment</span> Submit cell report
              </Button>
              <Button variant="secondary" onClick={onLogout}>
                <span className="material-symbols-outlined">logout</span> Log out
              </Button>
            </div>
          </div>
        </div>

        {!me ? (
          <p className="text-sm text-slate-600">We couldn't find your leader record yet. Ask your church admin to check your details.</p>
        ) : (
          <>
            <div className="dashboard-metrics grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Whole group attendance', node?.groupTotal || 0],
                ['Today', node?.groupToday || 0],
                ['Members in your group', node?.groupMembers || 0],
                ['Leaders under you', below.length],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-stat text-2xl text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {below.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4">
                <h3 className="font-headline text-sm text-slate-900 mb-2">Leaders under you</h3>
                <div className="divide-y divide-slate-100">
                  {below.map(n => (
                    <div key={n.id} className="flex justify-between py-2 text-xs">
                      <span><strong className="text-slate-900">{n.name}</strong> · {n.role} · {n.groupName}</span>
                      <span className="font-bold text-slate-900">{n.groupTotal} attendance</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white border border-slate-200 rounded-2xl p-4">
              <h3 className="font-headline text-sm text-slate-900 mb-2">Your members ({myMembers.length})</h3>
              {myMembers.length === 0 ? <p className="text-xs text-slate-500">No members linked to you yet.</p> : (
                <div className="divide-y divide-slate-100">
                  {myMembers.map(m => (
                    <div key={m.id} className="flex justify-between py-2 text-xs">
                      <span className="font-bold text-slate-900">{m.fullName}</span>
                      <span className="text-slate-500">{m.serviceCount} services · {m.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Account Footer Card with Walkthrough Button directly above User & Logout */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <Button variant="secondary" onClick={() => setShowWalkthrough(true)}>
              <span className="material-symbols-outlined">school</span>
              <span>Watch Step-by-Step Walkthrough</span>
            </Button>
            <div className="flex items-center gap-2.5 pt-1">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                {user.name?.trim().charAt(0).toUpperCase() || 'L'}
              </span>
              <div className="text-xs">
                <strong className="block text-slate-900">{user.name}</strong>
                <span className="text-slate-500">{me ? `${me.leaderType} · ${user.church}` : `Leader · ${user.church}`}</span>
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={onLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Log out</span>
          </Button>
        </section>
      </div>

      <DashboardWalkthrough
        isOpen={showWalkthrough}
        user={user}
        onClose={() => setShowWalkthrough(false)}
      />
    </div>
  );
};
