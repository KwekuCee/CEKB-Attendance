import React, { useState } from 'react';
import type { AuthSessionUser } from '../types';
import { AttendanceRecord, ChurchBranch, ViewType, Member, Leader } from '../types';
import { useToast } from '../context/ToastContext';
import { EditRecordModal, ConfirmDeleteDialog } from './EditRecordModal';
import { getGroupNamesForLeader, findLeaderByName } from '../utils/analyticsUtils';

interface AttendanceViewProps {
  attendanceRecords: AttendanceRecord[];
  user?: {
    name: string;
    role: AuthSessionUser['role'];
    church: string;
  };
  onNavigate: (view: ViewType) => void;
  onClearTodayAttendance?: () => void;
  serviceTypes?: { id: string; name: string; active: boolean }[];
  churches?: ChurchBranch[];
  members?: Member[];
  leaders?: Leader[];
  onUpdateAttendance?: (record: AttendanceRecord) => void;
  onDeleteAttendance?: (recordId: string) => void;
  onConfirmAttendance?: (record: AttendanceRecord) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  user,
  onNavigate,
  onClearTodayAttendance,
  serviceTypes,
  churches = [],
  members = [],
  leaders = [],
  onUpdateAttendance,
  onDeleteAttendance,
  onConfirmAttendance
}) => {
  const toast = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterService, setFilterService] = useState<string>('All');
  const [filterLeader, setFilterLeader] = useState<string>('All');
  const [filterChurch, setFilterChurch] = useState<string>('All');
  const [searchMember, setSearchMember] = useState<string>('');
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);
  const [savedArchives, setSavedArchives] = useState<string[]>([]);
  const [showManualPanel, setShowManualPanel] = useState<boolean>(false);
  const [manualSearch, setManualSearch] = useState<string>('');
  const [manualService, setManualService] = useState<string>('');

  const isChurchAdmin = user?.role === 'Church Admin' || (user?.role as string) === 'Church Pastor';
  const targetChurch = user?.church || '';

  const serviceOptions = (serviceTypes || []).filter(s => s.active).map(s => s.name);
  const activeServices = serviceOptions.length > 0 ? serviceOptions : ['Sunday Service'];
  const chosenService = manualService || activeServices[0];

  // People this admin may record: their own branch only
  const recordableMembers = isChurchAdmin
    ? (members || []).filter(m => m && m.church === targetChurch)
    : (members || []);

  const manualMatches = manualSearch.trim()
    ? recordableMembers.filter(m =>
      (m.fullName || '').toLowerCase().includes(manualSearch.trim().toLowerCase()) ||
      (m.id || '').toLowerCase().includes(manualSearch.trim().toLowerCase())
    ).slice(0, 10)
    : recordableMembers.slice(0, 10);

  const alreadyRecordedToday = (memberId: string, service: string) =>
    (attendanceRecords || []).some(r =>
      r && r.memberId === memberId && r.serviceType === service && (r.date || '').slice(0, 10) === todayStr
    );

  const handleManualRecord = (m: Member) => {
    if (alreadyRecordedToday(m.id, chosenService)) {
      toast.showError('Already recorded', `${m.fullName} is already marked present for ${chosenService} today.`);
      return;
    }
    const leader = m.invitedByLeaderId
      ? (leaders || []).find(l => l.id === m.invitedByLeaderId)
      : findLeaderByName(m.invitedBy, leaders);
    const groups = getGroupNamesForLeader(leader?.id, leaders);
    onConfirmAttendance?.({
      id: `att-${Date.now()}`,
      memberId: m.id,
      memberName: m.fullName,
      memberRole: m.role || 'Member',
      serviceType: chosenService,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: todayStr,
      verifiedBy: user?.name ? `${user.name} (recorded by hand)` : 'Church Admin',
      status: 'Confirmed',
      church: m.church || targetChurch || 'Unassigned',
      checkInMethod: 'Manual Admin',
      leaderName: leader?.fullName || m.invitedBy,
      pcfName: [groups.className, groups.cellName, groups.pcfName].filter(Boolean).join(' • ') || 'General PCF'
    });
    setManualSearch('');
    toast.showSuccess('Attendance recorded', `${m.fullName} is marked present for ${chosenService}.`);
  };

  // Filter scoped to Church Admin branch if applicable
  const scopedRecords = isChurchAdmin
    ? attendanceRecords.filter(r => r.church === targetChurch)
    : attendanceRecords;

  // Available unique dates
  const availableDates = Array.from(
    new Set([todayStr, ...savedArchives, ...scopedRecords.map(r => r.date || todayStr)])
  ).sort((a, b) => b.localeCompare(a));

  // Extract unique leaders for filter
  const leaderOptions = Array.from(
    new Set(
      scopedRecords
        .map(r => r.leaderName)
        .filter((l): l is string => Boolean(l && l.trim() && l !== 'Direct / Self'))
    )
  );

  // Apply filters
  const filteredRecords = scopedRecords.filter(r => {
    if (!r) return false;
    const recordDate = r.date || todayStr;
    const matchesDate = recordDate === selectedDate;
    const matchesService = filterService === 'All' || r.serviceType === filterService;
    const matchesLeader = filterLeader === 'All' || (r.leaderName && r.leaderName.toLowerCase().includes((filterLeader || '').toLowerCase()));
    const matchesChurch = isChurchAdmin ? true : (filterChurch === 'All' || r.church === filterChurch);

    const query = (searchMember || '').trim().toLowerCase();
    const memName = (r.memberName || '').toLowerCase();
    const memId = (r.memberId || '').toLowerCase();
    const ldrName = (r.leaderName || '').toLowerCase();
    const pcf = (r.pcfName || '').toLowerCase();

    const matchesSearch =
      !query ||
      memName.includes(query) ||
      memId.includes(query) ||
      ldrName.includes(query) ||
      pcf.includes(query);

    return matchesDate && matchesService && matchesLeader && matchesChurch && matchesSearch;
  });

  // Calculate stats for selected date
  const totalAttended = filteredRecords.length;
  const firstTimersCount = filteredRecords.filter(r => r.memberRole === 'First Timer').length;
  const regularMembersCount = filteredRecords.filter(r => r.memberRole === 'Member' || r.memberRole === 'Leader').length;

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = [
      'Member ID',
      'Full Name',
      'Role',
      'Church Branch',
      'Service Type',
      'Service Date',
      'Check-in Time',
      'Leader / PCF Leader',
      'Cell / PCF Name',
      'Check-in Method',
      'Status'
    ];

    const rows = filteredRecords.map(r => [
      r.memberId,
      `"${r.memberName}"`,
      r.memberRole,
      `"${r.church}"`,
      `"${r.serviceType}"`,
      r.date || selectedDate,
      `"${r.timestamp}"`,
      `"${r.leaderName || 'Direct / Self'}"`,
      `"${r.pcfName || 'General PCF'}"`,
      r.checkInMethod,
      r.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CE_Attendance_Report_${selectedDate}_${isChurchAdmin ? targetChurch.replace(/\s+/g, '_') : 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.showSuccess('Report Exported', `Attendance report for ${selectedDate} exported to Excel CSV.`);
  };

  // Finalize Service Day & Refresh Database
  const handleConfirmFinalizeService = () => {
    if (!savedArchives.includes(selectedDate)) {
      setSavedArchives(prev => [selectedDate, ...prev]);
    }
    setShowFinalizeModal(false);
    toast.showSuccess(
      'Service Day Finalized & Saved!',
      `Attendance record for ${selectedDate} has been archived. Station database refreshed for new service.`
    );
    if (onClearTodayAttendance && selectedDate === todayStr) {
      onClearTodayAttendance();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full mb-1.5 border border-emerald-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {isChurchAdmin ? `${targetChurch} Service Station` : 'Group Network Service Station'}
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Service Attendance Log
          </h1>
          <p className="font-body text-xs md:text-sm text-slate-500 mt-1">
            Real-time check-in stream, leader attribution, archive records, and downloadable Excel reports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onConfirmAttendance && (
            <button
              onClick={() => setShowManualPanel(v => !v)}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <span>Record attendance</span>
            </button>
          )}
          <button
            onClick={() => setShowFinalizeModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Finalize & Archive Day</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Record attendance by hand (for people without a phone) */}
      {showManualPanel && onConfirmAttendance && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-extrabold text-slate-900">Record attendance by hand</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                For people who came without a phone or a pass. {isChurchAdmin ? `Only ${targetChurch} people are listed.` : 'All branches are listed.'}
              </p>
            </div>
            <button
              onClick={() => setShowManualPanel(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={manualSearch}
              onChange={e => setManualSearch(e.target.value)}
              placeholder="Find a person by name or ID"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 text-slate-900 outline-none focus:border-blue-600 placeholder:text-slate-400"
            />
            <select
              value={chosenService}
              onChange={e => setManualService(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50 text-slate-900 outline-none focus:border-blue-600"
            >
              {activeServices.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {manualMatches.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-500">No one found in this branch.</p>
            )}
            {manualMatches.map(m => {
              const done = alreadyRecordedToday(m.id, chosenService);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{m.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.id} • {m.church} • {m.invitedBy || 'No leader yet'}
                    </p>
                  </div>
                  <button
                    disabled={done}
                    onClick={() => handleManualRecord(m)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${done
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'}`}
                  >
                    {done ? 'Recorded' : 'Mark present'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Verified Attendees ({selectedDate})</p>
            <p className="font-display text-2xl font-extrabold text-slate-900 mt-0.5">{totalAttended}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">First Timers / Converts</p>
            <p className="font-display text-2xl font-extrabold text-blue-700 mt-0.5">{firstTimersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">person_add</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Regular Members & Leaders</p>
            <p className="font-display text-2xl font-extrabold text-blue-600 mt-0.5">{regularMembersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">groups</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Service Date Selected</p>
            <p className="font-display text-sm font-extrabold text-slate-800 mt-1">{selectedDate}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">event</span>
          </div>
        </div>
      </div>

      {/* Main Filter & Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-4 md:p-6 space-y-4">

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pb-4 border-b border-slate-100">

          {/* Search Box */}
          <div className="relative lg:col-span-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search member or leader..."
              value={searchMember}
              onChange={e => setSearchMember(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Service Date Selector */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Service Date</label>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
            >
              {availableDates.map(d => (
                <option key={d} value={d}>
                  {d === todayStr ? `Today (${d})` : d}
                </option>
              ))}
            </select>
          </div>

          {/* Service Type Filter */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Service Type</label>
            <select
              value={filterService}
              onChange={e => setFilterService(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="All">All Service Types</option>
              <option value="Sunday Service">Sunday Service</option>
              <option value="Mid-week Service">Mid-week Service</option>
              <option value="Youth Ministry">Youth Ministry</option>
            </select>
          </div>

          {/* Leader / PCF Leader Filter */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Filter by Leader</label>
            <select
              value={filterLeader}
              onChange={e => setFilterLeader(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="All">All Leaders & PCFs</option>
              {leaderOptions.map(ldr => (
                <option key={ldr} value={ldr}>{ldr}</option>
              ))}
            </select>
          </div>

          {/* Church Filter (if Superadmin) */}
          {!isChurchAdmin ? (
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Church Branch</label>
              <select
                value={filterChurch}
                onChange={e => setFilterChurch(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
              >
                <option value="All">All Church Branches</option>
                {churches.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Branch Scope</label>
              <div className="border border-slate-200 bg-slate-100 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 truncate">
                {targetChurch}
              </div>
            </div>
          )}

        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Attendee Name & ID</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Leader / PCF Leader</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Role</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Service & Date</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Time & Station</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body text-xs divide-y divide-slate-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    {/* Attendee Name & ID */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{r.memberName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400">{r.memberId}</span>
                        <span className="text-xs text-slate-500 font-medium">• {r.church}</span>
                      </div>
                    </td>

                    {/* Member's Leader / PCF Leader */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{r.leaderName || 'Direct / Self'}</p>
                      <p className="text-xs text-slate-400">{r.pcfName || 'General PCF'}</p>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${r.memberRole === 'Leader' ? 'bg-blue-100 text-blue-900 border border-blue-100' :
                          r.memberRole === 'First Timer' ? 'bg-blue-50 text-blue-800 border border-blue-100' :
                              'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                        {r.memberRole}
                      </span>
                    </td>

                    {/* Service & Date */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-900 font-semibold">{r.serviceType}</p>
                      <p className="text-xs text-slate-400">{r.date || selectedDate}</p>
                    </td>

                    {/* Time & Station */}
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-700">{r.timestamp}</p>
                      <p className="text-xs text-slate-400">{r.verifiedBy} ({r.checkInMethod})</p>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Confirmed
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditingRecord(r)}
                        className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        title="Edit attendance entry"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingRecord(r)}
                        className="ml-1.5 inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                        title="Delete attendance entry"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    No attendance logs found for date <strong className="text-slate-700">{selectedDate}</strong> with current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Finalize & Refresh Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Finalize & Refresh Service Day</h3>
              <p className="font-body text-xs text-slate-500 mt-1">
                Are you sure you want to finalize and save the attendance report for <strong className="text-slate-900">{selectedDate}</strong>? This will archive the full attendance record and prepare the station database for the next service day.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Attendees Recorded:</span>
                <span className="font-bold text-slate-900">{totalAttended}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Service Branch:</span>
                <span className="font-bold text-slate-900">{isChurchAdmin ? targetChurch : 'Group Wide'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFinalizeService}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Yes, Save & Refresh
              </button>
            </div>
          </div>
        </div>
      )}


      {editingRecord && (
        <EditRecordModal
          title="Edit Attendance Entry"
          subtitle={`${editingRecord.memberName} • ${editingRecord.serviceType}`}
          icon="event_available"
          values={editingRecord as any}
          fields={[
            { key: 'memberName', label: 'Member Name', required: true },
            { key: 'memberId', label: 'Member ID', disabled: true },
            (serviceTypes && serviceTypes.length > 0
              ? { key: 'serviceType', label: 'Service Type', type: 'select' as const, options: serviceTypes.filter(st => st.active).map(st => st.name) }
              : { key: 'serviceType', label: 'Service Type' }),
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'timestamp', label: 'Check-in Time' },
            ...(isChurchAdmin ? [] : [{ key: 'church', label: 'Church Branch' }]),
            { key: 'leaderName', label: 'Leader' },
            { key: 'pcfName', label: 'Bible Study Class / Cell / PCF' },
            { key: 'verifiedBy', label: 'Verified By' }
          ]}
          onCancel={() => setEditingRecord(null)}
          onSave={(vals) => {
            onUpdateAttendance?.({ ...editingRecord, ...vals } as AttendanceRecord);
            toast.showSuccess('Attendance Updated', 'The check-in entry was saved.');
            setEditingRecord(null);
          }}
        />
      )}

      {deletingRecord && (
        <ConfirmDeleteDialog
          title="Delete Attendance Entry"
          message={`This removes the check-in for ${deletingRecord.memberName} on ${deletingRecord.date || selectedDate}.`}
          onCancel={() => setDeletingRecord(null)}
          onConfirm={() => {
            onDeleteAttendance?.(deletingRecord.id);
            toast.showSuccess('Attendance Deleted', 'The check-in entry was removed.');
            setDeletingRecord(null);
          }}
        />
      )}
    </div>
  );
};
