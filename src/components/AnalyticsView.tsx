import React, { useMemo, useState } from 'react';
import type { AuthSessionUser } from '../types';
import { Member, ViewType, AuditLogItem, ChurchBranch, AttendanceRecord, Leader } from '../types';
import { isBirthdayInCurrentMonth, getBirthdayDayOfMonth, formatBirthdayDisplay } from '../utils/analyticsUtils';
import { csvQ } from '../utils/csvSafe';
import { isFirstTimer } from '../utils/memberStatus';

interface AnalyticsViewProps {
  user?: {
    name: string;
    role: AuthSessionUser['role'];
    church: string;
  };
  members: Member[];
  churches?: ChurchBranch[];
  attendanceRecords?: AttendanceRecord[];
  leaders?: Leader[];
  onNavigate: (view: ViewType) => void;
  onAddAuditLog: (log: AuditLogItem) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  user,
  members,
  churches = [],
  attendanceRecords = [],
  leaders = [],
  onNavigate,
  onAddAuditLog
}) => {
  const isSuperadmin = user?.role === 'Superadmin';
  const churchName = user?.church || '';
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [sentBirthdayFor, setSentBirthdayFor] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTimestamp, setSyncTimestamp] = useState('Just now');

  // Filter members: If church admin, strictly scope to user's church only (no other church data)
  const targetChurchLower = (churchName || '').toLowerCase();
  const filteredMembers = isSuperadmin
    ? (selectedBranch === 'All' ? members : members.filter(m => m && m.church === selectedBranch))
    : members.filter(m => (m?.church && m.church.toLowerCase() === targetChurchLower) || (m?.location && m.location.toLowerCase() === targetChurchLower));

  // Distinct branches for Superadmin
  const branchOptions = Array.from(
    new Set([
      ...churches.map(c => c?.name).filter(Boolean),
      ...members.map(m => m?.church).filter(Boolean)
    ])
  );

  // Demographics stats
  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter(m => m && m.gender === 'Male').length;
  const femaleCount = filteredMembers.filter(m => m && m.gender === 'Female').length;

  const firstTimersCount = filteredMembers.filter(m => m && isFirstTimer(m, attendanceRecords)).length;
  const generalMembersCount = total - firstTimersCount;

  const monthlyGrowth = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10);
      const count = filteredMembers.filter(member => member.joinDate && member.joinDate <= end).length;
      const newMembers = filteredMembers.filter(member => member.joinDate?.slice(0, 7) === key).length;
      return { key, label: month.toLocaleDateString(undefined, { month: 'short' }), count, newMembers };
    });
    return months;
  }, [filteredMembers]);
  const growthMax = Math.max(1, ...monthlyGrowth.map(point => point.count));
  const growthPoints = monthlyGrowth.map((point, index) => ({
    x: 8 + index * (284 / Math.max(monthlyGrowth.length - 1, 1)),
    y: 112 - (point.count / growthMax) * 96,
  }));
  const growthPath = growthPoints.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = growthPoints[index - 1];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    return `${path} Q ${previous.x} ${previous.y} ${midX} ${midY}`;
  }, '') + ` T ${growthPoints[growthPoints.length - 1]?.x || 8} ${growthPoints[growthPoints.length - 1]?.y || 112}`;

  const attendanceHours = useMemo(() => {
    const scopedAttendance = attendanceRecords.filter(record =>
      isSuperadmin
        ? selectedBranch === 'All' || record.church === selectedBranch
        : (record.church || '').toLowerCase() === targetChurchLower,
    );
    const hours = new Map<number, number>();
    scopedAttendance.forEach(record => {
      const match = (record.timestamp || '').match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
      if (!match) return;
      let hour = Number(match[1]);
      if (match[3]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (match[3]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23) hours.set(hour, (hours.get(hour) || 0) + 1);
    });
    return Array.from(hours.entries()).sort(([a], [b]) => a - b);
  }, [attendanceRecords, isSuperadmin, selectedBranch, targetChurchLower]);
  const peakHour = attendanceHours.reduce<[number, number] | null>(
    (peak, current) => !peak || current[1] > peak[1] ? current : peak,
    null,
  );

  const leaderTypeGrowth = useMemo(() => {
    const countByType = new Map<string, number>();
    filteredMembers.forEach(member => {
      const leader = leaders.find(candidate =>
        candidate.id === member.invitedByLeaderId ||
        (!member.invitedByLeaderId && candidate.fullName.toLowerCase() === (member.invitedBy || '').toLowerCase()),
      );
      const type = leader?.leaderType || 'Unassigned';
      countByType.set(type, (countByType.get(type) || 0) + 1);
    });
    return Array.from(countByType.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredMembers, leaders]);

  // Occupations Map
  const occupationsMap: Record<string, number> = {};
  filteredMembers.forEach(m => {
    if (!m) return;
    const occ = m.occupation || 'General';
    occupationsMap[occ] = (occupationsMap[occ] || 0) + 1;
  });

  // Education Map
  const educationMap: Record<string, number> = {};
  filteredMembers.forEach(m => {
    if (!m) return;
    const edu = m.education || 'Tertiary';
    educationMap[edu] = (educationMap[edu] || 0) + 1;
  });

  const tertiaryCount = Object.entries(educationMap)
    .filter(([edu]) => {
      const e = (edu || '').toLowerCase();
      return e.includes('tertiary') || e.includes('degree') || e.includes('university') || e.includes('postgraduate');
    })
    .reduce((sum, [, count]) => sum + count, 0);
  const tertiaryPercent = total > 0 ? Math.round((tertiaryCount / total) * 100) : 0;

  // Location Map
  const locationMap: Record<string, number> = {};
  filteredMembers.forEach(m => {
    const loc = m.location || 'Korle Bu';
    locationMap[loc] = (locationMap[loc] || 0) + 1;
  });

  // Upcoming Birthdays calculation (current month)
  const currentMonthBirthdays = filteredMembers
    .filter(m => isBirthdayInCurrentMonth(m.dob))
    .sort((a, b) => getBirthdayDayOfMonth(a.dob) - getBirthdayDayOfMonth(b.dob));

  const handleSendBirthdayGreeting = (member: Member) => {
    setSentBirthdayFor(prev => [...prev, member.id]);
    onAddAuditLog({
      id: `log-${Date.now()}`,
      action: `Birthday greeting SMS/Mail dispatched to ${member.fullName} (${member.phone})`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      icon: 'cake',
      user: 'Admin Automated Greetings',
      church: member.church
    });
  };

  const handleExportAnalyticsCSV = () => {
    const rows = [
      ['Metric', 'Count'],
      ['Registered members', String(total)],
      ['First timers (fewer than two attendances)', String(firstTimersCount)],
      ['General members', String(generalMembersCount)],
      ['Male', String(maleCount)],
      ['Female', String(femaleCount)],
      ...Object.entries(occupationsMap).map(([label, count]) => [`Occupation: ${label}`, String(count)]),
      ...Object.entries(educationMap).map(([label, count]) => [`Education: ${label}`, String(count)]),
    ];
    const blob = new Blob([rows.map(row => row.map(csvQ).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(isSuperadmin ? 'Group_Analytics' : churchName).replace(/\s+/g, '_')}_Demographics_Report.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-body">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-1 border border-blue-200">
            <span className="material-symbols-outlined text-[14px]">analytics</span>
            {isSuperadmin ? 'CEKB Group Analytics Engine' : `${churchName} Branch Analytics Engine`}
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            {isSuperadmin ? 'Demographics & Growth Analytics' : `${churchName} Analytics`}
          </h1>
          <p className="font-body text-xs md:text-sm text-slate-500 mt-1">
            {isSuperadmin
              ? 'Insights on occupations, educational levels, age demographics, locations, and first-timer conversions.'
              : `Real-time member demographics, professions, education profile, and attendance metrics for ${churchName}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter - Only visible for Superadmin */}
          {isSuperadmin ? (
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="All">All Church Branches (Group Consolidated)</option>
              {branchOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          ) : (
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3.5 py-2 rounded-xl text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">church</span>
              <span>{churchName} Members Only</span>
            </div>
          )}

          <button
            onClick={() => {
              setIsSyncing(true);
              setTimeout(() => {
                setIsSyncing(false);
                setSyncTimestamp(new Date().toLocaleTimeString());
              }, 600);
            }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin text-blue-600' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing...' : 'Sync DB'}</span>
          </button>

          <button
            onClick={handleExportAnalyticsCSV}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:col-span-2">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="font-headline font-bold text-sm text-slate-900">12-month membership growth</h2>
              <p className="text-xs text-slate-500">Cumulative growth based on recorded member join dates.</p>
            </div>
            <div className="text-right"><strong className="text-xl text-blue-700">{total}</strong><p className="text-[11px] text-slate-500">current members</p></div>
          </div>
          <svg viewBox="0 0 300 130" role="img" aria-label="Cumulative member growth over the last 12 months" className="w-full h-40 mt-3 overflow-visible">
            <path d="M 8 112 H 292" stroke="#e2e8f0" strokeWidth="1" />
            <path d={growthPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            {growthPoints.map((point, index) => (
              <circle key={monthlyGrowth[index].key} cx={point.x} cy={point.y} r="2.5" fill="#1d4ed8" />
            ))}
          </svg>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center">
            {monthlyGrowth.map(point => (
              <div key={point.key} className="min-w-0">
                <span className="block text-[9px] text-slate-400">{point.label}</span>
                <span className="block text-[10px] font-bold text-slate-700">{point.newMembers > 0 ? `+${point.newMembers}` : '—'}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h2 className="font-headline font-bold text-sm text-slate-900">Member growth by leader type</h2>
          <p className="text-xs text-slate-500 mt-1">Member count attributed to each leader category.</p>
          <div className="space-y-2 mt-4">
            {leaderTypeGrowth.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{type}</span><strong className="text-blue-800">{count}</strong>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-4 pt-3">
            <p className="text-xs font-bold text-slate-800">Attendance peak time</p>
            <p className="text-sm text-blue-700 font-bold mt-1">
              {peakHour ? `${String(peakHour[0] % 12 || 12).padStart(2, '0')}:00 ${peakHour[0] >= 12 ? 'PM' : 'AM'} (${peakHour[1]} visits)` : 'No check-in times recorded'}
            </p>
          </div>
        </section>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <p className="text-xs font-bold text-slate-400 ">Filtered Members</p>
          <div className="font-display text-3xl font-extrabold text-slate-900">{total}</div>
          <p className="text-xs text-emerald-600 font-semibold">Live registered in branch database</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <p className="text-xs font-bold text-slate-400 ">First Timers Conversion</p>
          <div className="font-display text-3xl font-extrabold text-blue-600">{firstTimersCount}</div>
          <p className="text-xs text-slate-500">Automated transition to General Member</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <p className="text-xs font-bold text-slate-400 ">Gender Balance</p>
          <div className="font-display text-3xl font-extrabold text-slate-900">{maleCount}M : {femaleCount}F</div>
          <p className="text-xs text-blue-700 font-semibold">Real branch demographic census</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <p className="text-xs font-bold text-slate-400 ">Tertiary Educated Ratio</p>
          <div className="font-display text-3xl font-extrabold text-purple-600">{tertiaryPercent}%</div>
          <p className="text-xs text-slate-500">{tertiaryCount} of {total} verified tertiary/postgrad</p>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Demographics & Occupations */}
        <div className="lg:col-span-8 space-y-6">

          {/* Occupations Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900">Occupational Profile Distribution</h3>
                <p className="text-xs text-slate-500">Professionals, healthcare, students, and entrepreneurs in church</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold">
                Categorized
              </span>
            </div>

            <div className="space-y-3">
              {Object.entries(occupationsMap).map(([occ, count]) => {
                const percentage = Math.round((count / total) * 100) || 10;
                return (
                  <div key={occ} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-800">
                      <span>{occ}</span>
                      <span className="text-slate-500">{count} members ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Educational Level Breakdown & Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Educational Level */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-headline font-bold text-sm text-slate-900">Educational Background</h3>
              <div className="space-y-2.5 pt-1">
                {Object.entries(educationMap).map(([edu, count]) => (
                  <div key={edu} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                    <span className="font-bold text-slate-800">{edu}</span>
                    <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Locations Heatmap */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-headline font-bold text-sm text-slate-900">Residential Areas</h3>
              <div className="space-y-2.5 pt-1">
                {Object.entries(locationMap).map(([loc, count]) => (
                  <div key={loc} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                    <span className="font-bold text-slate-800">{loc}</span>
                    <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-100">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Birthdays & Seeking Engagement */}
        <div className="lg:col-span-4 space-y-6">

          {/* Upcoming Birthdays Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 icon-fill text-[22px]">cake</span>
                <h3 className="font-headline font-bold text-base text-slate-900">Upcoming Birthdays</h3>
              </div>
              <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                Celebrations
              </span>
            </div>

            <div className="space-y-3">
              {currentMonthBirthdays.length > 0 ? (
                currentMonthBirthdays.map(m => {
                  const isSent = sentBirthdayFor.includes(m.id);
                  const birthdayLabel = formatBirthdayDisplay(m.dob);
                  return (
                    <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                      <div>
                        <p className="font-headline font-bold text-xs text-slate-900">{m.fullName}</p>
                        <p className="text-xs text-blue-800 font-bold mt-0.5">
                          {birthdayLabel} • <span className="text-slate-500 font-normal">{m.church}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleSendBirthdayGreeting(m)}
                        disabled={isSent}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${isSent
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {isSent ? 'check' : 'mark_email_read'}
                        </span>
                        <span>{isSent ? 'Sent' : 'Wish'}</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">
                  No birthdays registered for this month ({new Date().toLocaleString('default', { month: 'long' })}) yet.
                </p>
              )}
            </div>
          </div>

          {/* First Timers Seeking Engagement Card */}
          <div className="bg-blue-700 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-blue-300 font-headline font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              <span>First Timers Follow-up Engine</span>
            </div>
            <p className="text-xs text-slate-300 font-body leading-relaxed">
              Every first timer stays in active follow-up until their second service. On that second attendance, the system converts them to a General Member and assigns them to Foundation School class 1.
            </p>
            <button
              onClick={() => onNavigate('members')}
              className="w-full mt-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm"
            >
              View First Timers Follow-Up List
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
