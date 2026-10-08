import { setServiceStartTime } from '../lib/supabaseService';
import React, { useState } from 'react';
import { ChurchBranch, AuditLogItem, ViewType, ChurchAdminAccount, Member, Leader, AttendanceRecord } from '../types';
import { HierarchyAttendancePanel } from './HierarchyAttendancePanel';
import { EditRecordModal, ConfirmDeleteDialog } from './EditRecordModal';
import { ImportDataPanel } from './ImportDataPanel';

interface GroupOverviewProps {
  churches: ChurchBranch[];
  churchAdmins: ChurchAdminAccount[];
  auditLogs: AuditLogItem[];
  members?: Member[];
  leaders?: Leader[];
  attendanceRecords?: AttendanceRecord[];
  onNavigate: (view: ViewType) => void;
  onOpenAnnouncement: () => void;
  onAddChurch: (church: ChurchBranch, admin?: ChurchAdminAccount) => void;
  onUpdateChurch?: (church: ChurchBranch) => void;
  onDeleteChurch?: (churchId: string) => void;
  onUpdateChurchAdmin?: (admin: ChurchAdminAccount) => void;
  onDeleteChurchAdmin?: (adminId: string) => void;
  onImported?: (newMembers: Member[], newLeaders: Leader[]) => void;
}

export const GroupOverview: React.FC<GroupOverviewProps> = ({
  churches,
  churchAdmins,
  auditLogs,
  members = [],
  leaders = [],
  attendanceRecords = [],
  onNavigate,
  onOpenAnnouncement,
  onAddChurch,
  onUpdateChurch,
  onDeleteChurch,
  onUpdateChurchAdmin,
  onDeleteChurchAdmin,
  onImported
}) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'admins'>('branches');
  const [editingChurch, setEditingChurch] = useState<ChurchBranch | null>(null);
  const [deletingChurch, setDeletingChurch] = useState<ChurchBranch | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<ChurchAdminAccount | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<ChurchAdminAccount | null>(null);
  const [serviceTypes, setServiceTypes] = useState<string[]>([
    'Sunday Service', 'Midweek Service', 'Special Service'
  ]);
  const [newServiceInput, setNewServiceInput] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [showAddChurchModal, setShowAddChurchModal] = useState(false);
  const [showFullLogsModal, setShowFullLogsModal] = useState(false);

  // New church form
  const [newChurchName, setNewChurchName] = useState('');
  const [newPastorName, setNewPastorName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newMembersCount, setNewMembersCount] = useState('500');
  const [newZone, setNewZone] = useState('Zone 1');
  const [authCode, setAuthCode] = useState('');
  const [formError, setFormError] = useState('');
  const [newServiceTime, setNewServiceTime] = useState('');
  const [newServiceGrace, setNewServiceGrace] = useState('15');

  const handleAddServiceType = () => {
    if (newServiceInput.trim()) {
      const name = newServiceInput.trim();
      setServiceTypes([...serviceTypes, name]);
      if (newServiceTime) setTimeout(() => setServiceStartTime(name, newServiceTime, Number(newServiceGrace) || 15), 1500);
      setNewServiceInput('');
      setNewServiceTime('');
      setShowAddService(false);
    }
  };

  const handleCreateChurch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (authCode.trim().toUpperCase() !== 'YOM26') {
      setFormError('Invalid Authentication Code! Please enter a valid security code.');
      return;
    }

    if (!newChurchName.trim() || !newPastorName.trim()) return;

    const createdBranch: ChurchBranch = {
      id: `CH-${Date.now().toString().slice(-4)}`,
      name: newChurchName.trim(),
      pastor: newPastorName.trim(),
      membersCount: parseInt(newMembersCount, 10) || 100,
      status: 'Healthy',
      zone: newZone,
      pcfCount: 1,
      cellCount: 4,
      bsctCount: 12
    };

    const createdAdmin: ChurchAdminAccount = {
      id: `ADM-${Math.floor(100 + Math.random() * 900)}`,
      adminName: newPastorName.trim(),
      adminEmail: newAdminEmail.trim() || `${newPastorName.toLowerCase().replace(/\s+/g, '')}@cekorlebu.org`,
      adminPhone: newAdminPhone.trim() || '+233 24 000 0000',
      churchName: newChurchName.trim(),
      zone: newZone,
      joinedDate: new Date().toISOString().slice(0, 10),
      status: 'Active'
    };

    onAddChurch(createdBranch, createdAdmin);
    setShowAddChurchModal(false);
    setNewChurchName('');
    setNewPastorName('');
    setNewAdminEmail('');
    setNewAdminPhone('');
    setAuthCode('');
  };

  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      group: 'CEKB Group',
      churchesCount: churches.length,
      churches,
      auditLogs
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CE_Korle_Bu_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-1">
            <span className="material-symbols-outlined text-[14px]">account_tree</span>
            CEKB Network Structure
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Group Network Overview
          </h1>
          <p className="font-body text-xs md:text-sm text-slate-500 mt-1">
            Manage church branches, service schedules, audit records, and group-wide backups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">backup</span>
            <span>Export Backup JSON</span>
          </button>

          <button
            onClick={onOpenAnnouncement}
            className="bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] text-blue-500 icon-fill">campaign</span>
            <span>Group Broadcast</span>
          </button>
        </div>
      </div>

      {/* Attendance across the whole group, grouped by PCF, cell and leader */}
      <HierarchyAttendancePanel
        members={members}
        leaders={leaders}
        attendance={attendanceRecords}
        showChurchLabel
      />

      {/* 3 Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
          <p className="text-xs font-bold text-slate-400 mb-2">
            Total Network Membership
          </p>
          <div className="font-display text-3xl font-extrabold text-slate-900">
            0
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            <span>+12% group growth MoM</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
          <p className="text-xs font-bold text-slate-400 mb-2">
            Active Church Branches
          </p>
          <div className="font-display text-3xl font-extrabold text-slate-900">
            {churches.length}
          </div>
          <p className="mt-2 text-xs text-slate-500">Supervised by Group Pastor</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm transition-all">
          <p className="text-xs font-bold text-slate-400 mb-2">
            Avg. Service Attendance
          </p>
          <div className="font-display text-3xl font-extrabold text-slate-900">
            0
          </div>
          <p className="mt-2 text-xs text-slate-500">Combined weekly attendance</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Church Network & Admin Summary Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setActiveTab('branches')}
                  className={`text-xs font-bold px-3 py-1 rounded-xl transition-all cursor-pointer ${activeTab === 'branches'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  Church Branches ({churches.length})
                </button>
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`text-xs font-bold px-3 py-1 rounded-xl transition-all cursor-pointer ${activeTab === 'admins'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  Registered Church Admins ({churchAdmins.length})
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {activeTab === 'branches'
                  ? 'Active church branches under CEKB Group'
                  : 'Details of registered church admins across the platform'}
              </p>
            </div>
            <button
              onClick={() => setShowAddChurchModal(true)}
              className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Register Church Branch</span>
            </button>
          </div>

          {activeTab === 'branches' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Church Name
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Head Pastor / Admin
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Membership
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Status
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body text-xs divide-y divide-slate-100">
                  {churches.length > 0 ? (
                    churches.map((church) => (
                      <tr key={church.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {church.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {church.pastor}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {church.membersCount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {church.status === 'Healthy' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                              <span>Healthy</span>
                            </span>
                          )}
                          {church.status === 'Review' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-bold border border-blue-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                              <span>Review</span>
                            </span>
                          )}
                          {church.status === 'Growing' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Growing</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditingChurch(church)}
                            className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeletingChurch(church)}
                            className="ml-1.5 inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        No church branches registered yet in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Admin Name
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Church Branch
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Contact Details
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200">
                      Account Status
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-400 border-b border-slate-200 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body text-xs divide-y divide-slate-100">
                  {churchAdmins.length > 0 ? (
                    churchAdmins.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {adm.adminName}
                        </td>
                        <td className="py-3.5 px-4 text-blue-700 font-semibold">
                          {adm.churchName}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-slate-800 font-medium">{adm.adminEmail}</p>
                          <p className="text-xs text-slate-400">{adm.adminPhone}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{adm.status}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditingAdmin(adm)}
                            className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeletingAdmin(adm)}
                            className="ml-1.5 inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        No church admin accounts registered yet in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Log & Service Types */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Service Types */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline text-base font-bold text-slate-900">
                Service Schedules
              </h3>
              <button
                onClick={() => setShowAddService(!showAddService)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Manage
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {serviceTypes.map((st, i) => (
                <span
                  key={i}
                  className="px-3 py-1 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-slate-50"
                >
                  {st}
                </span>
              ))}

              {showAddService ? (
                <div className="flex items-center gap-2 w-full mt-2">
                  <input
                    type="text"
                    value={newServiceInput}
                    onChange={(e) => setNewServiceInput(e.target.value)}
                    placeholder="New service name..."
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs flex-1 outline-none focus:border-blue-600"
                  />
                  <input type="time" value={newServiceTime} onChange={(e) => setNewServiceTime(e.target.value)} title="Service start time" aria-label="Service start time" className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs" />
                  <input type="number" min={0} value={newServiceGrace} onChange={(e) => setNewServiceGrace(e.target.value.replace(/\D/g, ''))} title="Minutes before marked late" aria-label="Minutes before marked late" className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-14" />
                  <button
                    onClick={handleAddServiceType}
                    className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddService(true)}
                  className="px-3 py-1 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* System Audit Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex-1 flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-4">
                System Audit Stream
              </h3>

              <div className="space-y-3">
                {auditLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex gap-3 items-start text-xs">
                    <span className="material-symbols-outlined text-slate-400 text-[18px] mt-0.5">
                      {log.icon}
                    </span>
                    <div>
                      <p className="text-slate-800 font-semibold leading-snug">{log.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{log.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowFullLogsModal(true)}
              className="w-full mt-4 py-2.5 text-center text-xs font-bold text-blue-600 border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer rounded-b-2xl"
            >
              View Full Audit Log History
            </button>
          </div>

        </div>

      </div>

      {/* Add Church Modal */}
      {showAddChurchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateChurch} className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-sm space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-headline font-bold text-lg text-slate-900">Register New Church Branch</h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Church Name *</label>
              <input
                type="text"
                required
                value={newChurchName}
                onChange={e => setNewChurchName(e.target.value)}
                placeholder="e.g. your church branch name"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Head Pastor / Admin *</label>
                <input
                  type="text"
                  required
                  value={newPastorName}
                  onChange={e => setNewPastorName(e.target.value)}
                  placeholder="e.g. Pastor Michael"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Admin Email</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  placeholder="pastor@cekorlebu.org"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Admin Phone</label>
                <input
                  type="text"
                  value={newAdminPhone}
                  onChange={e => setNewAdminPhone(e.target.value)}
                  placeholder="+233 24 000 0000"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Initial Membership Count</label>
              <input
                type="number"
                value={newMembersCount}
                onChange={e => setNewMembersCount(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            {/* Security Code */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
              <label className="block text-xs font-black text-blue-900 uppercase">
                Auth Code Required *
              </label>
              <input
                type="text"
                required
                value={authCode}
                onChange={e => setAuthCode(e.target.value)}
                placeholder="Enter Security Code"
                className="w-full border border-blue-300 rounded-lg p-2 text-xs bg-white font-bold tracking-wider text-blue-900 outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddChurchModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Register Church
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full Audit Logs Modal */}
      {showFullLogsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-headline font-bold text-lg text-slate-900">Audit Trail History</h3>
              <button onClick={() => setShowFullLogsModal(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex gap-3 items-start text-xs">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">
                    {log.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p className="text-xs text-slate-400">
                      {log.timestamp} • Executed by {log.user || 'Admin'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowFullLogsModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}


      {editingChurch && (
        <EditRecordModal
          title="Edit Church Branch"
          subtitle={editingChurch.name}
          icon="church"
          values={editingChurch as any}
          fields={[
            { key: 'name', label: 'Branch Name', required: true },
            { key: 'pastor', label: 'Pastor in Charge' },
            { key: 'membersCount', label: 'Members Count', type: 'number' },
            { key: 'status', label: 'Status', type: 'select', options: ['Healthy', 'Review', 'Growing'] }
          ]}
          onCancel={() => setEditingChurch(null)}
          onSave={(vals) => {
            onUpdateChurch?.({ ...editingChurch, ...vals } as ChurchBranch);
            setEditingChurch(null);
          }}
        />
      )}

      {deletingChurch && (
        <ConfirmDeleteDialog
          title="Delete Church Branch"
          message={`This permanently removes ${deletingChurch.name} and unlinks its records.`}
          onCancel={() => setDeletingChurch(null)}
          onConfirm={() => {
            onDeleteChurch?.(deletingChurch.id);
            setDeletingChurch(null);
          }}
        />
      )}

      {editingAdmin && (
        <EditRecordModal
          title="Edit Church Admin"
          subtitle={`${editingAdmin.adminName} • ${editingAdmin.churchName}`}
          icon="manage_accounts"
          values={editingAdmin as any}
          fields={[
            { key: 'adminName', label: 'Admin Name', required: true },
            { key: 'adminEmail', label: 'Email', type: 'email' },
            { key: 'adminPhone', label: 'Phone', type: 'tel' },
            { key: 'churchName', label: 'Church Branch' },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending Verification'] }
          ]}
          onCancel={() => setEditingAdmin(null)}
          onSave={(vals) => {
            onUpdateChurchAdmin?.({ ...editingAdmin, ...vals } as ChurchAdminAccount);
            setEditingAdmin(null);
          }}
        />
      )}

      {deletingAdmin && (
        <ConfirmDeleteDialog
          title="Delete Church Admin"
          message={`This removes the admin account for ${deletingAdmin.adminName}.`}
          onCancel={() => setDeletingAdmin(null)}
          onConfirm={() => {
            onDeleteChurchAdmin?.(deletingAdmin.id);
            setDeletingAdmin(null);
          }}
        />
      )}
      <div className="pb-8">
        <ImportDataPanel
          members={members}
          leaders={leaders}
          churches={churches}
          defaultChurch={churches[0]?.name || ''}
          canChooseChurch
          onImported={(m, l) => onImported?.(m, l)}
        />
      </div>

    </div>
  );
};
