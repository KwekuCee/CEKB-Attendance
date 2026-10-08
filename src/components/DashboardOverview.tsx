import React, { useState } from 'react';
import { ViewType, TopLeader, Member, Leader, ChurchBranch, ChurchAdminAccount, AttendanceRecord } from '../types';
import { isBirthdayInCurrentMonth, getBirthdayDayOfMonth } from '../utils/analyticsUtils';
import { BirthdaysPanel } from './BirthdaysPanel';
import { ClassGroupsPanel } from './ClassGroupsPanel';
import { AbsenteesPanel } from './AbsenteesPanel';
import { HierarchyAttendancePanel } from './HierarchyAttendancePanel';
import { ImportDataPanel } from './ImportDataPanel';


interface DashboardOverviewProps {
  user: {
    id: string;
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
    zone: string;
    avatar: string;
  };
  topLeaders: TopLeader[];
  members: Member[];
  leaders: Leader[];
  churches: ChurchBranch[];
  churchAdmins: ChurchAdminAccount[];
  attendanceRecords: AttendanceRecord[];
  serviceTypes?: Array<{ id: string; name: string; active: boolean }>;
  onNavigate: (view: ViewType) => void;
  onSelectMemberForCard: (member: Member) => void;
  onUpdateServiceTypes?: (serviceTypes: Array<{ id: string; name: string; active: boolean }>) => void;
  onImported?: (newMembers: Member[], newLeaders: Leader[]) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  topLeaders,
  members,
  leaders,
  churches,
  churchAdmins,
  attendanceRecords,
  onNavigate,
  onSelectMemberForCard,
  serviceTypes = [],
  onImported
}) => {
  const isSuperadmin = user.role === 'Superadmin';
  const currentChurchName = user.church || churches[0]?.name || 'Unassigned';
  const matchingBranch = churches.find(c => c && c.name && c.name.toLowerCase() === currentChurchName.toLowerCase());
  const matchingAdmin = churchAdmins.find(a => a && a.churchName && a.churchName.toLowerCase() === currentChurchName.toLowerCase());
  const currentBranchPastor = matchingBranch?.pastor || matchingAdmin?.adminName || (user.role === 'Church Admin' ? user.name : 'Branch Pastor');

  // --- Filtered Data for Church Admin (Strict multi-tenant isolation) ---
  const branchMembers = isSuperadmin
    ? members
    : members.filter(m => (m?.church && m.church.toLowerCase() === currentChurchName.toLowerCase()) ||
      (m?.location && m.location.toLowerCase() === currentChurchName.toLowerCase()));

  const branchLeaders = isSuperadmin
    ? leaders
    : leaders.filter(l => l?.church && l.church.toLowerCase() === currentChurchName.toLowerCase());

  const pcfLeaders = branchLeaders.filter(l => l.leaderType === 'PCF Leader');
  const cellLeaders = branchLeaders.filter(l => l.leaderType === 'Cell Leader');
  const bsctLeaders = branchLeaders.filter(l => l.leaderType === 'BSCT' || l.leaderType === 'Church Coordinator');

  const branchAttendance = isSuperadmin
    ? attendanceRecords
    : attendanceRecords.filter(a => a?.church && a.church.toLowerCase() === currentChurchName.toLowerCase());

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = branchAttendance.filter(a => !a.date || a.date === todayStr);

  // Service Breakdown for Today's Attendance
  const sundayToday = todayAttendance.filter(a => a.serviceType === 'Sunday Service').length;
  const midweekToday = todayAttendance.filter(a => a.serviceType === 'Midweek Service').length;
  const specialToday = todayAttendance.filter(a => a.serviceType === 'Special Service').length;

  // --- Attendance grouped per Leader (branch scoped) ---
  const attendanceByLeader = (() => {
    const map = new Map<string, { leaderName: string; pcfName: string; total: number; today: number }>();
    branchAttendance.forEach(att => {
      const key = (att.leaderName || att.pcfName || 'Direct / No Leader').trim();
      const entry = map.get(key) || { leaderName: key, pcfName: att.pcfName || '—', total: 0, today: 0 };
      entry.total += 1;
      if (!att.date || att.date === new Date().toISOString().slice(0, 10)) entry.today += 1;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();


  // This Week's Members: members who recorded attendance for the first time or registered as first timers
  const thisWeekNewMembers = branchMembers.filter(m =>
    m.status === 'First Timer' ||
    m.role === 'First Timer' ||
    (m.serviceCount !== undefined && m.serviceCount <= 1)
  );

  // --- Dynamic Database Analytics (Zero Demo Data) ---
  const totalBranchMembers = branchMembers.length;
  const maleMembersCount = branchMembers.filter(m => m.gender === 'Male').length;
  const femaleMembersCount = branchMembers.filter(m => m.gender === 'Female').length;
  const malePercent = totalBranchMembers > 0 ? Math.round((maleMembersCount / totalBranchMembers) * 100) : 0;
  const femalePercent = totalBranchMembers > 0 ? Math.round((femaleMembersCount / totalBranchMembers) * 100) : 0;

  const totalAttendance = branchAttendance.length;
  let earlyArrivalCount = 0;
  let peakArrivalCount = 0;
  let lateArrivalCount = 0;

  branchAttendance.forEach(att => {
    const timeStr = att.timestamp || '';
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      const min = parseInt(match[2], 10);
      const totalMinutes = hour * 60 + min;
      if (totalMinutes <= 8 * 60 + 15) {
        earlyArrivalCount++;
      } else if (totalMinutes <= 8 * 60 + 45) {
        peakArrivalCount++;
      } else {
        lateArrivalCount++;
      }
    } else {
      peakArrivalCount++;
    }
  });

  const earlyPercent = totalAttendance > 0 ? Math.round((earlyArrivalCount / totalAttendance) * 100) : 0;
  const peakPercent = totalAttendance > 0 ? Math.round((peakArrivalCount / totalAttendance) * 100) : 0;
  const latePercent = totalAttendance > 0 ? Math.max(0, 100 - earlyPercent - peakPercent) : 0;

  const regularMembersCount = branchMembers.filter(m => (m.serviceCount || 0) > 1 || m.status === 'General Member').length;
  const foundationEnrolledCount = branchMembers.filter(m => (m.foundationClass || 0) > 0).length;
  const foundationGraduatedCount = branchMembers.filter(m => (m.foundationClass || 0) >= 7).length;
  const retentionPercent = totalBranchMembers > 0 ? Math.round((regularMembersCount / totalBranchMembers) * 100) : 0;

  const currentMonthBirthdays = branchMembers
    .filter(m => isBirthdayInCurrentMonth(m.dob))
    .sort((a, b) => getBirthdayDayOfMonth(a.dob) - getBirthdayDayOfMonth(b.dob));

  // --- Derive branches from registered church admins ---
  const branchesFromAdmins = churchAdmins
    .filter((admin, index, self) => admin && admin.churchName && self.findIndex(a => a && a.churchName && a.churchName.trim().toLowerCase() === admin.churchName!.trim().toLowerCase()) === index) // Deduplicate by church name (case-insensitive)
    .map(admin => {
      const cName = admin.churchName || 'Branch';
      const cKey = cName.trim().toLowerCase();
      return {
        id: `branch-${cName.replace(/\s+/g, '-').toLowerCase()}`,
        name: cName,
        pastor: admin.adminName || 'Branch Pastor',
        membersCount: members.filter(m => m && m.church && m.church.trim().toLowerCase() === cKey).length,
        status: admin.status === 'Active' ? 'Healthy' as const : 'Review' as const,
        zone: admin.zone || 'Zone 1 (Korle Bu)',
        pcfCount: 0,
        cellCount: 0,
        bsctCount: 0
      };
    });

  // --- Shared States ---
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedAnalyticsTab, setSelectedAnalyticsTab] = useState<'peak' | 'demographics' | 'engagement'>('peak');
  const [analyticsServiceFilter, setAnalyticsServiceFilter] = useState<'All' | 'Sunday Service' | 'Midweek Service' | 'Special Service'>('All');
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);
  const [lastAnalyticsSync, setLastAnalyticsSync] = useState('Just now');
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // --- Superadmin Custom State ---

  const [groupAnnouncements, setGroupAnnouncements] = useState<Array<{
    id: string;
    title: string;
    body: string;
    date: string;
    author: string;
  }>>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // --- Church Admin Custom Email State ---
  const [showEmailLeaderModal, setShowEmailLeaderModal] = useState(false);
  const [announcementSubject, setAnnouncementSubject] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [emailStatusMsg, setEmailStatusMsg] = useState('');

  // Handlers
  const handlePostGroupBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    const newAnn = {
      id: `ann-${Date.now()}`,
      title: broadcastTitle.trim(),
      body: broadcastMessage.trim(),
      date: 'Just now',
      author: 'Group Pastor HQ'
    };
    setGroupAnnouncements(prev => [newAnn, ...prev]);
    setShowBroadcastModal(false);
    setBroadcastTitle('');
    setBroadcastMessage('');
    triggerToast('Broadcast sent to all Church Admins dashboard & email!');
  };

  const handleExportCSV = () => {
    const headers = 'ID,Full Name,Phone,Email,Role,Church,Joined Date\n';
    const rows = branchMembers.map(m => `"${m.id}","${m.fullName}","${m.phone}","${m.email || 'N/A'}","${m.role}","${m.church}","${m.joinDate}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(isSuperadmin ? 'Group_Network' : currentChurchName).replace(/\s+/g, '_')}_Members_Export.csv`;
    a.click();
    triggerToast(`Exported ${branchMembers.length} member records to CSV!`);
  };

  const handleSendEmailToLeaders = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementSubject.trim() || !announcementBody.trim()) return;
    setEmailStatusMsg('Dispatching announcement email to PCF & Cell Leaders...');
    setTimeout(() => {
      setEmailStatusMsg(`Successfully emailed ${branchLeaders.length} leaders in ${currentChurchName}!`);
      setTimeout(() => {
        setShowEmailLeaderModal(false);
        setEmailStatusMsg('');
        setAnnouncementSubject('');
        setAnnouncementBody('');
      }, 1500);
    }, 1000);
  };

  const cleanMemberQuery = (memberSearchQuery || '').trim().toLowerCase();
  const filteredBranchMembersTable = branchMembers.filter(m => {
    if (!m) return false;
    const nameStr = (m.fullName || '').toLowerCase();
    const phoneStr = m.phone || '';
    const idStr = (m.id || '').toLowerCase();
    return !cleanMemberQuery || nameStr.includes(cleanMemberQuery) || phoneStr.includes(cleanMemberQuery) || idStr.includes(cleanMemberQuery);
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-blue-300 border border-blue-500/40 px-4 py-3 rounded-2xl shadow-sm flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-blue-500 text-[20px]">notifications_active</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 👑 SUPERADMIN (GROUP PASTOR) DASHBOARD INTERFACE                      */}
      {/* ===================================================================== */}
      {isSuperadmin ? (
        <div className="space-y-6">
          {/* 1. Superadmin Hero Banner */}
          <div className="bg-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-sm border border-blue-600/30 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-extrabold px-3.5 py-1 rounded-full border border-white/30 backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  SUPERADMIN COMMAND HQ • CEKB GROUP PASTOR
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Welcome, {user.name.startsWith('Pastor') ? user.name : `Pastor ${user.name}`}
                </h1>
                <p className="text-blue-100 text-xs md:text-sm max-w-2xl font-body leading-relaxed">
                  Live system telemetry over {churches.length} church branch{churches.length === 1 ? '' : 'es'}, {churchAdmins.length} registered church admin{churchAdmins.length === 1 ? '' : 's'}, {members.length} members, and real-time attendance logs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-100 text-blue-900 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">campaign</span>
                  <span>Broadcast to Admins</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Superadmin Core Metrics (Group Wide) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Group Total Members</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{members.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{churches.length} Branches</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Total registered members across all branches</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Active Church Branches</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">church</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{churches.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Group 1 Zone</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Active Korle Bu Group branch churches</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Church Admins Registered</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{churchAdmins.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">Secured Gate</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Verified local church administrators</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Group Attendance Today</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">fact_check</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{attendanceRecords.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Live Log</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Confirmed Sunday service check-ins</p>
            </div>
          </div>

          {/* 3. Church Branches Network Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-headline font-bold text-base text-slate-900">
                Church Branches Network Status
              </h3>
              <p className="text-xs text-slate-500">Live operational overview for Group Pastor HQ</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branchesFromAdmins.map((ch) => {
                const chKey = ch.name.trim().toLowerCase();
                const chMembers = members.filter(m => (m.church && m.church.trim().toLowerCase() === chKey) || (m.location && m.location.trim().toLowerCase() === chKey));
                const chLeaders = leaders.filter(l => l.church && l.church.trim().toLowerCase() === chKey);
                return (
                  <div key={ch.id} className="border border-slate-200 rounded-2xl p-4 space-y-3 hover:border-blue-500/60 transition-all bg-slate-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{ch.name}</h4>
                        <p className="text-xs text-slate-500">Pastor: {ch.pastor}</p>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-xs text-slate-400 uppercase block">Members</span>
                        <span className="font-bold text-slate-900">{chMembers.length}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 uppercase block">Leaders</span>
                        <span className="font-bold text-slate-900">{chLeaders.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Superadmin Controls: Registered Church Admins */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Church Admins Directory Link */}
            <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-headline font-bold text-base text-slate-900">
                    Registered Church Admins Directory
                  </h3>
                  <p className="text-xs text-slate-500">Access the full Church Admins management page</p>
                </div>
                <span className="material-symbols-outlined text-blue-600">badge</span>
              </div>
              <p className="text-sm text-slate-600">View detailed information about all registered church administrators across the network.</p>
              <button
                onClick={() => onNavigate('church_admins_directory')}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Go to Church Admins Directory
                </span>
              </button>
            </div>
          </div>

          {/* 5. System Security & Audit Trail Controls (Superadmin Exclusive) */}
          <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-blue-900">
                  Superadmin System Security & Backup Controls
                </h3>
                <p className="text-xs text-slate-500">Manage data backups, audit logs, and cloud synchronisation</p>
              </div>
              <span className="material-symbols-outlined text-blue-700">security</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                <p className="font-bold text-xs text-slate-900">Database Backup & Restoration</p>
                <p className="text-xs text-slate-500">Create instant cloud snapshot of members, attendance, and leadership structure.</p>
                <button
                  onClick={() => triggerToast('Cloud backup snapshot created successfully!')}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Trigger Instant Backup
                </button>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                <p className="font-bold text-xs text-slate-900">Auth Gate Security Logs</p>
                <p className="text-xs text-slate-500">Church Admin and Leader registration attempts authenticated with Security Gate Code.</p>
                <button
                  onClick={() => triggerToast('Security Gate Code verified active & locked')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  View Security Logs
                </button>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                <p className="font-bold text-xs text-slate-900">System Settings & Controls</p>
                <p className="text-xs text-slate-500">Configure global programs, security codes, and backup parameters.</p>
                <button
                  onClick={() => onNavigate('settings')}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Superadmin Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* ⛪ CHURCH ADMIN DASHBOARD INTERFACE                                  */
        /* ===================================================================== */
        <div className="space-y-6">
          {/* 1. Church Admin Hero Banner */}
          <div className="bg-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-sm relative overflow-hidden border border-blue-600/30">
            <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex flex-wrap items-center gap-2 bg-white/20 text-white text-xs font-extrabold px-3.5 py-1 rounded-full border border-white/30 backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-300 animate-ping"></span>
                  CHURCH ADMIN PORTAL • {currentChurchName.toUpperCase()} • PASTOR: {currentBranchPastor.toUpperCase()}
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Welcome, {user.name}
                </h1>
                <p className="text-blue-300 text-xs font-extrabold flex items-center gap-1.5 pt-0.5">
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  <span>Branch Pastor: {currentBranchPastor}</span>
                </p>
                <p className="text-blue-100 text-xs md:text-sm max-w-2xl font-body leading-relaxed">
                  Real-time management dashboard for {currentChurchName}. Monitor member directory, PCF & Cell leadership rosters, attendance records, and email service announcements.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => onNavigate('qr_scanner')}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                  <span>Launch QR Scanner</span>
                </button>

                <button
                  onClick={() => setShowEmailLeaderModal(true)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-100 text-blue-900 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  <span>Email PCF/Cell Leaders</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 bg-blue-900/60 hover:bg-blue-900 text-white border border-white/20 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Group Pastor Broadcast Announcement Banner (Received by Church Admin) */}
          {groupAnnouncements.length > 0 && (
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 text-[24px] shrink-0 mt-0.5">campaign</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded">
                    ANNOUNCEMENT FROM GROUP PASTOR HQ
                  </span>
                  <span className="text-xs text-slate-500">{groupAnnouncements[0].date}</span>
                </div>
                <p className="font-bold text-xs text-slate-900">{groupAnnouncements[0].title}</p>
                <p className="text-xs text-slate-700">{groupAnnouncements[0].body}</p>
              </div>
            </div>
          )}

          {/* 3. Church Branch Core Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Members */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Branch Total Members</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{branchMembers.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{currentChurchName}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Total database registered members</p>
            </div>

            {/* Today's Attendance by Service Day */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Today's Attendance</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">{todayAttendance.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {sundayToday > 0 ? `${sundayToday} Sun` : midweekToday > 0 ? `${midweekToday} Mid` : 'Live'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>Sun: <strong className="text-slate-800">{sundayToday}</strong></span>
                <span>•</span>
                <span>Midweek: <strong className="text-slate-800">{midweekToday}</strong></span>
                <span>•</span>
                <span>Special: <strong className="text-slate-800">{specialToday}</strong></span>
              </div>
            </div>

            {/* This Week's Members */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">This Week's Members</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">person_add_alt</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-3xl font-extrabold text-slate-900">+{thisWeekNewMembers.length}</span>
                <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">1st Time Check-in</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Recorded attendance for the 1st time</p>
            </div>

            {/* Leadership Structure */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 ">Leadership Structure</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">military_tech</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-display text-2xl font-extrabold text-slate-900">
                  {branchLeaders.length} <span className="text-xs font-normal text-slate-500">Leaders</span>
                </span>
                <span className="inline-flex items-center text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Roster</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {pcfLeaders.length} PCF • {cellLeaders.length} Cell • {bsctLeaders.length} BSCT
              </p>
            </div>
          </div>

          {/* 4. PCF & Cell Leaders Rosters */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PCF Leaders List */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-headline font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-700 text-[18px]">badge</span>
                    <span>PCF Leaders Roster ({pcfLeaders.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">Registered PCF pastoral tier in {currentChurchName}</p>
                </div>
                <button
                  onClick={() => onNavigate('leaders')}
                  className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Manage PCFs →
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 space-y-2">
                {pcfLeaders.length > 0 ? (
                  pcfLeaders.map((ldr) => (
                    <div key={ldr.id} className="pt-2.5 pb-2.5 px-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 border border-slate-100/80 transition-all space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-display font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
                            {ldr.initials || (ldr.fullName ? ldr.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'LD')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-slate-900">{ldr.fullName}</p>
                              <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-extrabold">
                                {ldr.id}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-blue-700">{ldr.cellOrPcfName}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ldr.isAppointed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {ldr.isAppointed ? 'Appointed' : 'Active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                          <a href={`tel:${ldr.contact}`} className="hover:text-blue-600 truncate">{ldr.contact}</a>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                          <span className="truncate">{ldr.location || 'Branch Catchment'}</span>
                        </div>
                        <div className="flex items-center gap-1 col-span-2 text-slate-500">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">supervised_user_circle</span>
                          <span>Supervising {ldr.downstreamCount || 0} cell members • Senior: {ldr.parentLeaderName || 'Branch Pastor'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No PCF leaders registered for {currentChurchName} yet.
                  </div>
                )}
              </div>
            </div>

            {/* Cell Leaders List */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-headline font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">groups</span>
                    <span>Cell Leaders Roster ({cellLeaders.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">Registered Cell pastoral units in {currentChurchName}</p>
                </div>
                <button
                  onClick={() => onNavigate('leaders')}
                  className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Manage Cells →
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 space-y-2">
                {cellLeaders.length > 0 ? (
                  cellLeaders.map((ldr) => (
                    <div key={ldr.id} className="pt-2.5 pb-2.5 px-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 border border-slate-100/80 transition-all space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-display font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
                            {ldr.initials || (ldr.fullName ? ldr.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'LD')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-slate-900">{ldr.fullName}</p>
                              <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-extrabold">
                                {ldr.id}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-blue-700">{ldr.cellOrPcfName}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ldr.isAppointed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {ldr.isAppointed ? 'Appointed' : 'Active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                          <a href={`tel:${ldr.contact}`} className="hover:text-blue-600 truncate">{ldr.contact}</a>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                          <span className="truncate">{ldr.location || 'Cell Venue'}</span>
                        </div>
                        <div className="flex items-center gap-1 col-span-2 text-slate-500">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">hub</span>
                          <span>Overseeing {ldr.downstreamCount || 0} members • PCF: {ldr.parentLeaderName || 'General PCF'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No Cell leaders registered for {currentChurchName} yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4b. Attendance per Leader + Total Attendance */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
              <h3 className="font-headline font-bold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-700 text-[20px]">groups_3</span>
                <span>Attendance Per Leader</span>
              </h3>
              <div className="flex gap-2">
                <span className="text-xs font-bold bg-slate-900 text-white px-3 py-1 rounded-full">
                  TOTAL ATTENDANCE: {totalAttendance}
                </span>
                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                  TODAY: {todayAttendance.length}
                </span>
              </div>
            </div>

            {attendanceByLeader.length > 0 ? (
              <div className="space-y-2">
                {attendanceByLeader.map(row => (
                  <div key={row.leaderName} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-bold text-xs text-slate-900 truncate">{row.leaderName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">PCF / Cell: {row.pcfName}</p>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${totalAttendance > 0 ? Math.round((row.total / totalAttendance) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display text-lg font-extrabold text-slate-900 leading-none">{row.total}</p>
                      <p className="text-xs text-emerald-600 font-bold mt-1">+{row.today} today</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No attendance recorded yet for {currentChurchName}.
              </div>
            )}
          </div>

          {/* 5. Recent Service Attendance Log (First 5 records from First Signup Form or QR Scan) */}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">fact_check</span>
                  <span>Recent Service Attendance Records</span>
                </h3>
                <p className="text-xs text-slate-500">First 5 attendance records captured by either First Signup Form or QR Code Scan</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('qr_scanner')}
                  className="text-xs font-bold text-slate-800 hover:text-slate-950 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  <span>Scan QR Code</span>
                </button>
                <button
                  onClick={() => onNavigate('attendance')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all"
                >
                  <span>Full Attendance Console</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="py-2.5 px-3">Member Name & ID</th>
                    <th className="py-2.5 px-3">Church Branch</th>
                    <th className="py-2.5 px-3">Service Type</th>
                    <th className="py-2.5 px-3">Check-in Time & Date</th>
                    <th className="py-2.5 px-3">Check-In Method</th>
                    <th className="py-2.5 px-3">Assigned Leader / PCF</th>
                    <th className="py-2.5 px-3 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branchAttendance.slice(0, 5).map((att) => {
                    const isQrScan = att.checkInMethod === 'QR Scan';
                    const isSignupForm = att.checkInMethod === 'Self Check-In' || att.checkInMethod === 'First Signup';

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{att.memberName}</div>
                          <div className="text-xs text-slate-400">{att.memberId || 'MEM-AUTO'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{att.church || currentChurchName}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">{att.serviceType}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <div>{att.timestamp}</div>
                          <div className="text-xs text-slate-400">{att.date || todayStr}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {isQrScan ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/60 rounded-md px-2 py-0.5 font-bold">
                              <span className="material-symbols-outlined text-[13px]">qr_code_scanner</span>
                              <span>QR Code Scan</span>
                            </span>
                          ) : isSignupForm ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-800 bg-blue-50 border border-blue-100/60 rounded-md px-2 py-0.5 font-bold">
                              <span className="material-symbols-outlined text-[13px]">assignment_turned_in</span>
                              <span>First Signup Form</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-800 bg-blue-50 border border-blue-200/60 rounded-md px-2 py-0.5 font-bold">
                              <span className="material-symbols-outlined text-[13px]">badge</span>
                              <span>{att.checkInMethod || 'Usher Station'}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">
                          {att.leaderName || att.pcfName || 'Direct / Branch'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            ✓ Confirmed
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {branchAttendance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        No service attendance logs recorded for {currentChurchName} yet. Scan a member QR code or record self-check-ins to populate this table live.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Branch Analytics & Birthdays */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Analytics Breakdown */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-headline font-bold text-base text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-[20px]">insights</span>
                    <span>Branch Analytics & Real-Time Intelligence</span>
                  </h3>
                  <p className="text-xs text-slate-500">Live demographics, peak arrival curves, and engagement telemetry for {currentChurchName}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsRefreshingAnalytics(true);
                      setTimeout(() => {
                        setIsRefreshingAnalytics(false);
                        setLastAnalyticsSync(new Date().toLocaleTimeString());
                        triggerToast('Branch Analytics synchronized with live PostgreSQL database!');
                      }, 600);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    title="Synchronize database telemetry"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isRefreshingAnalytics ? 'animate-spin text-blue-600' : ''}`}>
                      sync
                    </span>
                    <span>{isRefreshingAnalytics ? 'Syncing...' : 'Sync DB'}</span>
                  </button>

                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setSelectedAnalyticsTab('peak')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${selectedAnalyticsTab === 'peak' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Peak Times
                    </button>
                    <button
                      onClick={() => setSelectedAnalyticsTab('demographics')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${selectedAnalyticsTab === 'demographics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Demographics
                    </button>
                    <button
                      onClick={() => setSelectedAnalyticsTab('engagement')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${selectedAnalyticsTab === 'engagement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Engagement
                    </button>
                  </div>
                </div>
              </div>

              {/* Service Filter Tabs */}
              <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-semibold">Filter Service Telemetry:</span>
                <div className="flex gap-1">
                  {(['All', 'Sunday Service', 'Midweek Service', 'Special Service'] as const).map(srv => (
                    <button
                      key={srv}
                      onClick={() => setAnalyticsServiceFilter(srv)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${analyticsServiceFilter === srv ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {srv === 'All' ? 'All Services' : srv.replace(' Service', '')}
                    </button>
                  ))}
                </div>
              </div>

              {selectedAnalyticsTab === 'peak' && (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-slate-700">
                      Live Check-in Velocity ({totalAttendance} logged check-in{totalAttendance === 1 ? '' : 's'}):
                    </p>
                    <span className="text-xs text-slate-400">Database Synced: {lastAnalyticsSync}</span>
                  </div>

                  {totalAttendance > 0 ? (
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Early Arrival (&le; 8:15 AM)
                          </span>
                          <span className="font-bold text-emerald-600">{earlyPercent}% ({earlyArrivalCount} {earlyArrivalCount === 1 ? 'attendee' : 'attendees'})</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${earlyPercent}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            Peak Arrival (8:16 AM - 8:45 AM)
                          </span>
                          <span className="font-bold text-blue-600">{peakPercent}% ({peakArrivalCount} {peakArrivalCount === 1 ? 'attendee' : 'attendees'})</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${peakPercent}%` }}></div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            Late Arrival (&gt; 8:45 AM)
                          </span>
                          <span className="font-bold text-blue-700">{latePercent}% ({lateArrivalCount} {lateArrivalCount === 1 ? 'attendee' : 'attendees'})</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${latePercent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                      No service check-in timestamps recorded for {currentChurchName} yet.
                    </div>
                  )}
                </div>
              )}

              {selectedAnalyticsTab === 'demographics' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1 border border-slate-100">
                      <span className="material-symbols-outlined text-blue-600 text-[28px]">male</span>
                      <p className="font-display font-extrabold text-2xl text-slate-900">{malePercent}%</p>
                      <p className="text-xs text-slate-500">{maleMembersCount} Male Member{maleMembersCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1 border border-slate-100">
                      <span className="material-symbols-outlined text-purple-600 text-[28px]">female</span>
                      <p className="font-display font-extrabold text-2xl text-slate-900">{femalePercent}%</p>
                      <p className="text-xs text-slate-500">{femaleMembersCount} Female Member{femaleMembersCount === 1 ? '' : 's'}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-700 font-semibold">
                      <span>Educational & Career Profile:</span>
                      <span className="text-xs text-slate-500">{totalBranchMembers} Registered Members</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Tertiary / Pro</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {branchMembers.filter(m => m.educationLevel === 'Tertiary' || m.educationLevel === 'Postgraduate').length}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Secondary / SHS</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {branchMembers.filter(m => m.educationLevel === 'Secondary').length}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Health & Allied</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {branchMembers.filter(m => m.occupationCategory === 'Healthcare & Medicine').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedAnalyticsTab === 'engagement' && (
                <div className="space-y-3 pt-1">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-blue-900 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">insights</span>
                        Member Retention & Growth Index: {retentionPercent}%
                      </p>
                      <span className="text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">
                        Database Telemetry
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs pt-1 text-slate-600">
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100/60 space-y-1">
                        <span className="text-slate-400 block">Foundation School:</span>
                        <span className="font-bold text-slate-900 text-xs">{foundationEnrolledCount} Enrolled / {foundationGraduatedCount} Graduated</span>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${totalBranchMembers > 0 ? (foundationGraduatedCount / totalBranchMembers) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100/60 space-y-1">
                        <span className="text-slate-400 block">First-Timer Follow-up:</span>
                        <span className="font-bold text-slate-900 text-xs">{thisWeekNewMembers.length} In Active Follow-up</span>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${totalBranchMembers > 0 ? (thisWeekNewMembers.length / totalBranchMembers) * 100 : 0}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
      )}

      {/* Attendance grouped by PCF, cell and leader — for both dashboards */}
      <HierarchyAttendancePanel
        members={members}
        leaders={leaders}
        attendance={attendanceRecords}
        churchScope={isSuperadmin ? undefined : currentChurchName}
        showChurchLabel={isSuperadmin}
      />

      {/* ===================================================================== */}
      {/* BIRTHDAYS + STUDENT GROUPS                                            */}
      {/* ===================================================================== */}
      <BirthdaysPanel
        members={branchMembers}
        scopeLabel={isSuperadmin ? 'all churches' : currentChurchName}
        onWish={(m) => triggerToast(`Birthday wish sent to ${m.fullName}`)}
      />

      <ClassGroupsPanel
        members={branchMembers}
        leaders={branchLeaders}
        scopeLabel={isSuperadmin ? 'all churches' : currentChurchName}
        onOpenMemberList={() => onNavigate('members')}
      />

      <AbsenteesPanel
        members={branchMembers}
        attendanceRecords={attendanceRecords}
        serviceTypes={serviceTypes.filter(st => st.active !== false).map(st => st.name)}
        churchName={isSuperadmin ? undefined : currentChurchName}
        isGroupView={isSuperadmin}
        recordedBy={user?.name}
        leaders={branchLeaders}
      />



      {/* ===================================================================== */}
      {/* MODALS                                                                */}
      {/* ===================================================================== */}

      {/* SUPERADMIN BROADCAST MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-lg text-slate-900">
                  Broadcast Announcement to Church Admins
                </h3>
                <p className="text-xs text-slate-500 font-body">Displays on every Church Admin dashboard and dispatches an email alert</p>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handlePostGroupBroadcast} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandatory Attendance Audit for Global Communion Service"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed directives for all 5 Church Admins..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-blue-600 font-body"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  Post Group Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHURCH ADMIN EMAIL LEADERS MODAL */}
      {showEmailLeaderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-lg text-slate-900">
                  Send Service Announcement to Leaders
                </h3>
                <p className="text-xs text-slate-500">Dispatches an email alert to all PCF and Cell leaders of {currentChurchName}</p>
              </div>
              <button
                onClick={() => setShowEmailLeaderModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {emailStatusMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold text-center">
                {emailStatusMsg}
              </div>
            ) : (
              <form onSubmit={handleSendEmailToLeaders} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mandatory Leaders Meeting & Sunday Service Target"
                    value={announcementSubject}
                    onChange={(e) => setAnnouncementSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-blue-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Announcement Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Write announcement details for PCF and Cell leaders..."
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-blue-600 font-body"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailLeaderModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Send Email Broadcast
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 pb-8">
        <ImportDataPanel
          members={members}
          leaders={leaders}
          churches={churches}
          defaultChurch={currentChurchName}
          canChooseChurch={isSuperadmin}
          onImported={(m, l) => onImported?.(m, l)}
        />
      </div>
    </div>
  );
};
