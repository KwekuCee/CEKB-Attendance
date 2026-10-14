import React, { useEffect, useMemo, useState } from 'react';
import { Leader, Member, AttendanceRecord, AuthSessionUser } from '../types';
import { buildLeaderAttendanceTree, flattenLeaderNode } from '../utils/analyticsUtils';
import { Button } from './Button';
import { DashboardWalkthrough, hasSeenWalkthrough } from './DashboardWalkthrough';
import { LeaderSidebar, type LeaderTab } from './LeaderSidebar';
import { LeaderEvangelismPanel } from './LeaderEvangelismPanel';
import { LeaderCellReportView } from './LeaderCellReportView';
import { CellReportCodeModal } from './CellReportCodeModal';

interface Props {
  user: AuthSessionUser;
  leaders: Leader[];
  members: Member[];
  attendance: AttendanceRecord[];
  onLogout: () => void;
  onAddMember?: (member: Member) => void;
}

/** Leader portal: dashboard overview, evangelism upload & conversion, members, and gated cell report sheet. */
export const LeaderHome: React.FC<Props> = ({
  user,
  leaders,
  members,
  attendance,
  onLogout,
  onAddMember,
}) => {
  const [currentTab, setCurrentTab] = useState<LeaderTab>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Cell report code gate
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const [reportCode, setReportCode] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);

  useEffect(() => {
    if (!hasSeenWalkthrough(user)) {
      setShowWalkthrough(true);
    }
  }, [user.email, user.name, user.role]);

  const same = (v?: string) => (v || '').toLowerCase() === (user.church || '').toLowerCase();
  const scoped = useMemo(
    () => ({
      leaders: leaders.filter((l) => same(l.church)),
      members: members.filter((m) => same(m.church)),
      attendance: attendance.filter((a) => same(a.church)),
    }),
    [leaders, members, attendance, user.church],
  );

  const me =
    scoped.leaders.find((l) => (l.email || '').toLowerCase() === (user.email || '').toLowerCase()) ||
    scoped.leaders.find((l) => (l.fullName || '').toLowerCase() === (user.name || '').toLowerCase());

  const tree = useMemo(
    () => buildLeaderAttendanceTree(scoped.members, scoped.leaders, scoped.attendance),
    [scoped],
  );
  const node = me ? tree.nodes.find((n) => n.id === me.id) : undefined;
  const below = node ? flattenLeaderNode(node) : [];
  const myMembers = me
    ? scoped.members.filter(
        (m) =>
          m.invitedByLeaderId === me.id ||
          (m.invitedBy || '').toLowerCase() === me.fullName.toLowerCase(),
      )
    : [];

  const handleCellReportClick = () => {
    if (isReportUnlocked) {
      setCurrentTab('cell_report');
    } else {
      setShowCodeModal(true);
    }
  };

  const handleCodeVerified = (code: string) => {
    setIsReportUnlocked(true);
    setReportCode(code);
    setShowCodeModal(false);
    setCurrentTab('cell_report');
  };

  return (
    <div className="dashboard-shell flex h-screen bg-background overflow-hidden font-body text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Dark Navigation Rail Sidebar */}
      <LeaderSidebar
        currentTab={currentTab}
        user={user}
        leader={me}
        onNavigate={(tab) => setCurrentTab(tab)}
        onSubmitCellReportClick={handleCellReportClick}
        onLogout={onLogout}
        onStartWalkthrough={() => setShowWalkthrough(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Container */}
      <div className="dashboard-workspace flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header Bar */}
        <header className="mobile-app-header md:hidden px-4 py-3 bg-slate-900 text-white flex items-center justify-between z-30 shrink-0 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="ghost"
              className="text-white p-1 hover:bg-white/10"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </Button>
            <div className="min-w-0">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block truncate">
                {user.church}
              </span>
              <h2 className="text-xs font-bold truncate text-white">{user.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              className="text-white/80 p-1 hover:text-white"
              onClick={handleCellReportClick}
              title="Submit cell report"
              aria-label="Submit cell report"
            >
              <span className="material-symbols-outlined text-xl">assignment</span>
            </Button>
            <Button
              variant="ghost"
              className="text-rose-400 p-1 hover:text-rose-300 hover:bg-rose-500/10"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </Button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {currentTab === 'overview' && (
            <div className="space-y-6 max-w-5xl">
              {/* Welcome Banner */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                    {user.church}
                  </span>
                  <h1 className="text-xl md:text-2xl font-headline font-bold text-slate-900 tracking-tight">
                    Welcome back, {user.name}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {me ? `${me.leaderType} · ${me.cellOrPcfName || 'Cell Leader'}` : 'Leader Portal'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => setShowWalkthrough(true)}>
                    <span className="material-symbols-outlined text-base">school</span>
                    <span>Watch Walkthrough</span>
                  </Button>
                  <Button onClick={() => setCurrentTab('evangelism')}>
                    <span className="material-symbols-outlined text-base">campaign</span>
                    <span>Evangelism Data</span>
                  </Button>
                  <Button variant="secondary" onClick={handleCellReportClick}>
                    <span className="material-symbols-outlined text-base">assignment</span>
                    <span>Submit cell report</span>
                  </Button>
                </div>
              </div>

              {!me ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
                  We could not find your leader record linked to this account yet. Ask your Church Administrator or Pastor to verify your details in the directory.
                </div>
              ) : (
                <>
                  {/* High-Level Attendance Metrics */}
                  <div data-tour="leader-attendance" className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Group Attendance', val: node?.groupTotal || 0, icon: 'trending_up', color: 'text-blue-600' },
                      { label: "Today's Check-ins", val: node?.groupToday || 0, icon: 'event_available', color: 'text-emerald-600' },
                      { label: 'Your Members', val: myMembers.length, icon: 'group', color: 'text-purple-600' },
                      { label: 'Leaders Under You', val: below.length, icon: 'diversity_3', color: 'text-amber-600' },
                    ].map((item) => (
                      <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                          <span className={`material-symbols-outlined text-lg ${item.color}`}>{item.icon}</span>
                        </div>
                        <p className="font-stat text-2xl font-bold text-slate-900 mt-2">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Leaders Under You */}
                  {below.length > 0 && (
                    <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-headline font-bold text-sm text-slate-900">
                          Leaders Under You ({below.length})
                        </h3>
                        <span className="text-xs text-slate-500">Hierarchy Rollup</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {below.map((n) => (
                          <div key={n.id} className="flex justify-between py-2.5 text-xs items-center">
                            <div>
                              <strong className="text-slate-900">{n.name}</strong>
                              <span className="text-slate-500 ml-1.5">· {n.role} · {n.groupName}</span>
                            </div>
                            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {n.groupTotal} attendance
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* My Members List Preview */}
                  <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline font-bold text-sm text-slate-900">
                        Cell Members ({myMembers.length})
                      </h3>
                      <Button variant="ghost" className="text-xs text-blue-600" onClick={() => setCurrentTab('members')}>
                        View All
                      </Button>
                    </div>

                    {myMembers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                        <p>No members linked to you yet.</p>
                        <Button variant="secondary" onClick={() => setCurrentTab('evangelism')}>
                          <span className="material-symbols-outlined text-sm">campaign</span>
                          <span>Upload Evangelism Contacts</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {myMembers.slice(0, 8).map((m) => (
                          <div key={m.id} className="flex justify-between py-2.5 text-xs items-center">
                            <div>
                              <span className="font-bold text-slate-900">{m.fullName}</span>
                              <span className="text-slate-400 ml-2">ID: {m.id}</span>
                            </div>
                            <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 text-[11px]">
                              {m.serviceCount} services · {m.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* TAB 2: EVANGELISM & SOULWINNING */}
          {currentTab === 'evangelism' && (
            <LeaderEvangelismPanel
              user={user}
              leader={me}
              onAddMember={onAddMember}
            />
          )}

          {/* TAB 3: CELL MEMBERS */}
          {currentTab === 'members' && (
            <div className="space-y-6 max-w-5xl">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                    Cell Membership Directory
                  </span>
                  <h2 className="text-xl md:text-2xl font-headline font-bold text-slate-900 tracking-tight">
                    Your Cell Members ({myMembers.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Members invited or mentored by {user.name} at {user.church}.
                  </p>
                </div>

                <Button onClick={() => setCurrentTab('evangelism')}>
                  <span className="material-symbols-outlined text-base">campaign</span>
                  <span>Add from Evangelism</span>
                </Button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {myMembers.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">group</span>
                    <p>No members currently assigned to your cell.</p>
                    <p className="text-slate-400">When people you reach through evangelism attend church, they will appear here automatically.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Member Name</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4">Role / Status</th>
                          <th className="py-3 px-4">Services Attended</th>
                          <th className="py-3 px-4">Foundation Class</th>
                          <th className="py-3 px-4">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {m.fullName}
                              <div className="text-[10px] text-slate-400 font-normal">ID: {m.id}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {m.phone ? (
                                <a href={`tel:${m.phone}`} className="hover:text-blue-600">
                                  {m.phone}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                m.status === 'General Member'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {m.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {m.serviceCount || 0} services
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              Class {m.foundationClass || 0}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {m.joinDate || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SUBMIT CELL REPORT */}
          {currentTab === 'cell_report' && (
            <div className="max-w-4xl">
              <LeaderCellReportView
                user={user}
                leader={me}
                reportCode={reportCode}
                onSubmittedSuccess={() => setCurrentTab('overview')}
              />
            </div>
          )}
        </main>
      </div>

      {/* Code Verification Modal when opening cell report */}
      <CellReportCodeModal
        isOpen={showCodeModal}
        churchName={user.church}
        onClose={() => setShowCodeModal(false)}
        onCodeVerified={handleCodeVerified}
      />

      {/* Step-by-Step Walkthrough Modal */}
      <DashboardWalkthrough
        isOpen={showWalkthrough}
        user={user}
        onClose={() => setShowWalkthrough(false)}
      />
    </div>
  );
};
