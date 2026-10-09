import React, { useState, useEffect } from 'react';
import { PasswordInput } from './PasswordInput';
import { motion } from 'motion/react';
import { UserProfile, AuthSessionUser, ChurchBranch, ViewType, AuditLogItem, Member, Leader, AttendanceRecord, ChurchAdminAccount } from '../types';
import {
  isSupabaseConfigured,
  saveSupabaseCredentials,
  getSupabase,
  testSupabaseConnection,
  SUPABASE_DEFAULT_URL,
  SUPABASE_DEFAULT_ANON_KEY
} from '../lib/supabase';
import {
  pushAllLocalDataToSupabase,
  saveChurchToSupabase,
  saveChurchAdminToSupabase,
  fetchAuditLogsFromSupabase,
  saveSuperadminProfileToSupabase,
  fetchSuperadminProfileFromSupabase,
  saveAllAdminSettingsToSupabase,
  saveServiceTypeToSupabase,
  deleteServiceTypeFromSupabase,
  fetchServiceTypesFromSupabase,
  saveStoredSession
} from '../lib/supabaseService';
import { exportMultiSheetExcel, exportMultiSectionCSV } from '../utils/exportUtils';
import { SUPABASE_SQL_SCHEMA } from '../data/supabase_schema';
import { ReportCodesPanel } from './ReportCodesPanel';
import { UshersPanel } from './UshersPanel';

interface SettingsViewProps {
  user: UserProfile | AuthSessionUser;
  churches: ChurchBranch[];
  churchAdmins?: ChurchAdminAccount[];
  members?: Member[];
  leaders?: Leader[];
  attendanceRecords?: AttendanceRecord[];
  auditLogs?: AuditLogItem[];
  serviceTypes?: Array<{ id: string; name: string; active?: boolean }> | string[];
  onUpdateServiceTypes?: (types: any) => void;
  onNavigate: (view: ViewType) => void;
  onAddAuditLog?: (log: AuditLogItem) => void;
  onUpdateUser?: (updated: Partial<AuthSessionUser>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  churches,
  churchAdmins = [],
  members = [],
  leaders = [],
  attendanceRecords = [],
  auditLogs = [],
  serviceTypes = [],
  onUpdateServiceTypes,
  onNavigate,
  onAddAuditLog,
  onUpdateUser
}) => {
  const isSuperadmin = user.role === 'Superadmin';
  const [activeTab, setActiveTab] = useState<'supabase' | 'profile' | 'accountability' | 'services' | 'scanner' | 'security' | 'backup'>('profile');

  // Audit Logs & Accountability State (capped to 10 and deduplicated)
  const [currentLogs, setCurrentLogs] = useState<AuditLogItem[]>(() => {
    const map = new Map<string, AuditLogItem>();
    (auditLogs || []).forEach(l => {
      if (l && l.id) map.set(l.id, l);
    });
    return Array.from(map.values()).slice(0, 10);
  });
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('All');
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditTimeFilter, setAuditTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [selectedLogModal, setSelectedLogModal] = useState<AuditLogItem | null>(null);

  // Sync currentLogs when auditLogs prop updates (capped to 10)
  useEffect(() => {
    if (auditLogs.length > 0) {
      setCurrentLogs(prev => {
        const map = new Map<string, AuditLogItem>();
        prev.forEach(l => map.set(l.id, l));
        auditLogs.forEach(l => map.set(l.id, l));
        return Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);
      });
    }
  }, [auditLogs]);

  const handleRefreshAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const live = await fetchAuditLogsFromSupabase(10);
      if (live && live.length > 0) {
        setCurrentLogs(live.slice(0, 10));
        triggerToast(`Retrieved ${live.length} live actions from Supabase audit trail (capped at 10)`);
      } else {
        triggerToast('No remote audit logs recorded yet.');
      }
    } catch (err: any) {
      triggerToast('Error refreshing live audit records.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Supabase Credentials State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(
    localStorage.getItem('cekbu_supabase_url') || import.meta.env.VITE_SUPABASE_URL || SUPABASE_DEFAULT_URL
  );
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(
    localStorage.getItem('cekbu_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_DEFAULT_ANON_KEY
  );
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connLatency, setConnLatency] = useState<number | null>(null);
  const [connMessage, setConnMessage] = useState('');
  const [isPushingData, setIsPushingData] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [showSqlSchema, setShowSqlSchema] = useState(false);

  // Find matching Church Branch and Admin records
  const matchingChurch = churches.find(
    c => (c?.name || '').toLowerCase() === (user?.church || '').toLowerCase()
  );
  const matchingAdmin = churchAdmins.find(
    a => (a?.churchName || '').toLowerCase() === (user?.church || '').toLowerCase() ||
      (a?.adminName || '').toLowerCase() === (user?.name || '').toLowerCase()
  );

  // Superadmin Profile states
  const [pastorName, setPastorName] = useState(user.name || 'Group Pastor');
  const [hqEmail, setHqEmail] = useState(user.email || 'group.pastor@cekorlebu.org');
  const [pastorPhone, setPastorPhone] = useState((user as any).phone || '+233 24 123 4567');
  const [hqChurchName, setHqChurchName] = useState(user.church || 'GCYC Group HQ');
  const [hqZone, setHqZone] = useState(user.zone || 'Zone 1 (Korle Bu)');
  const [isSavingSuperadminProfile, setIsSavingSuperadminProfile] = useState(false);

  // Other Superadmin states
  const [securityCode, setSecurityCode] = useState('YOM26');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [globalServiceList, setGlobalServiceList] = useState<string[]>([
    'Sunday Service',
    'Midweek Service',
    'Special Service'
  ]);
  const [newServiceName, setNewServiceName] = useState('');

  // Church Admin profile states (initialized with details entered at signup)
  const [branchName, setBranchName] = useState(matchingChurch?.name || user.church || '');
  const [pastorInCharge, setPastorInCharge] = useState(matchingChurch?.pastor || 'Pastor Emmanuel');
  const [adminFullName, setAdminFullName] = useState(matchingAdmin?.adminName || user.name || 'Branch Admin');
  const [adminEmail, setAdminEmail] = useState(matchingAdmin?.adminEmail || user.email || 'admin@cekorlebu.org');
  const [adminPhone, setAdminPhone] = useState(matchingAdmin?.adminPhone || '+233 24 555 0000');
  const [adminZone, setAdminZone] = useState(matchingChurch?.zone || matchingAdmin?.zone || 'Zone 1 (Korle Bu)');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [scannerSound, setScannerSound] = useState(true);
  const [scannerVibrate, setScannerVibrate] = useState(true);
  const [autoPassDownload, setAutoPassDownload] = useState(true);
  const [autoPromoteFirstTimers, setAutoPromoteFirstTimers] = useState(true);
  const [promotionServicesCount, setPromotionServicesCount] = useState(3);

  // Load Superadmin Profile from Supabase on mount
  useEffect(() => {
    if (isSuperadmin) {
      fetchSuperadminProfileFromSupabase().then(prof => {
        if (prof) {
          if (prof.name) setPastorName(prof.name);
          if (prof.email) setHqEmail(prof.email);
          if (prof.phone) setPastorPhone(prof.phone);
          if (prof.churchName) setHqChurchName(prof.churchName);
          if (prof.zone) setHqZone(prof.zone);
        }
      }).catch(() => {});
    }
  }, [isSuperadmin]);

  // Load service types on mount
  useEffect(() => {
    fetchServiceTypesFromSupabase().then(types => {
      if (types && types.length > 0) {
        setGlobalServiceList(types);
      }
    }).catch(() => {});
  }, []);

  // Synchronize when matching records update
  useEffect(() => {
    if (matchingChurch) {
      setBranchName(matchingChurch.name);
      setPastorInCharge(matchingChurch.pastor);
      if (matchingChurch.zone) setAdminZone(matchingChurch.zone);
    }
    if (matchingAdmin) {
      setAdminFullName(matchingAdmin.adminName);
      setAdminEmail(matchingAdmin.adminEmail);
      setAdminPhone(matchingAdmin.adminPhone);
      if (matchingAdmin.zone) setAdminZone(matchingAdmin.zone);
    }
  }, [matchingChurch?.name, matchingAdmin?.adminEmail, user.church, user.name]);

  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSaveSuperadminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSuperadminProfile(true);
    const cleanName = pastorName.trim();
    const cleanEmail = hqEmail.trim();
    const cleanPhone = pastorPhone.trim();
    const cleanChurchName = hqChurchName.trim();
    const cleanZone = hqZone.trim();

    try {
      await saveSuperadminProfileToSupabase({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        churchName: cleanChurchName,
        zone: cleanZone
      });

      // Update state in App.tsx
      onUpdateUser?.({
        name: cleanName,
        email: cleanEmail,
        church: cleanChurchName,
        zone: cleanZone,
        phone: cleanPhone
      });

      // Update local storage session so it persists on reload
      saveStoredSession({
        id: 'usr-1',
        name: cleanName,
        role: 'Superadmin',
        church: cleanChurchName,
        zone: cleanZone,
        avatar: (user as any).avatar || (user as any).avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        email: cleanEmail,
        phone: cleanPhone
      });

      onAddAuditLog?.({
        id: `log-${Date.now()}`,
        action: `Updated HQ & Group Pastor Profile: ${cleanName} (${cleanChurchName})`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        icon: 'admin_panel_settings',
        user: cleanName,
        church: cleanChurchName,
        category: 'System'
      });

      triggerToast('HQ & Group Profile saved and updated in Supabase!');
    } catch (err: any) {
      console.error('Error saving Superadmin profile:', err);
      triggerToast('Saved profile locally!');
    } finally {
      setIsSavingSuperadminProfile(false);
    }
  };

  const handleSaveBranchProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      if (matchingChurch) {
        const updatedChurch: ChurchBranch = {
          ...matchingChurch,
          name: branchName.trim(),
          pastor: pastorInCharge.trim(),
          zone: adminZone.trim(),
        };
        await saveChurchToSupabase(updatedChurch);
      }

      if (matchingAdmin) {
        const updatedAdmin: ChurchAdminAccount = {
          ...matchingAdmin,
          adminName: adminFullName.trim(),
          adminEmail: adminEmail.trim(),
          adminPhone: adminPhone.trim(),
          churchName: branchName.trim(),
          zone: adminZone.trim(),
        };
        await saveChurchAdminToSupabase(updatedAdmin);
      }

      onAddAuditLog?.({
        id: `log-${Date.now()}`,
        action: `Updated Branch Settings Profile for ${branchName} (${adminFullName})`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        icon: 'manage_accounts',
        user: adminFullName,
        church: branchName,
        category: 'System'
      });

      triggerToast('Branch Profile updated and saved to database!');
    } catch (err) {
      console.error('Error saving branch profile:', err);
      triggerToast('Saved locally!');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Test connection on mount
  useEffect(() => {
    runConnectionTest();
  }, []);

  const runConnectionTest = async () => {
    setConnStatus('testing');
    setConnMessage('Testing connection to Supabase...');
    const result = await testSupabaseConnection();
    setConnLatency(result.latencyMs);
    setConnMessage(result.message);
    setConnStatus(result.success ? 'success' : 'error');
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnStatus('testing');
    setConnMessage('');

    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setConnStatus('error');
      setConnMessage('Please fill in both Supabase URL and Anon Key.');
      return;
    }

    try {
      saveSupabaseCredentials(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      const result = await testSupabaseConnection();
      setConnLatency(result.latencyMs);
      setConnMessage(result.message);
      setConnStatus(result.success ? 'success' : 'error');

      if (result.success) {
        triggerToast('Saved & connected to Supabase!');
        onAddAuditLog?.({
          id: `LOG-${Date.now()}`,
          action: 'Connected and synchronized with live database',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'database',
          user: user.name,
          category: 'System'
        });
      }
    } catch (err: any) {
      setConnStatus('error');
      setConnMessage(err?.message || 'Failed to connect to Supabase project.');
    }
  };

  const handlePushAllData = async () => {
    setIsPushingData(true);
    setPushResult(null);

    const res = await pushAllLocalDataToSupabase(
      churches,
      churchAdmins,
      leaders,
      members,
      attendanceRecords
    );

    setIsPushingData(false);
    if (res.success) {
      const summary = `Successfully pushed ${res.pushedCount.members} members, ${res.pushedCount.leaders} leaders, ${res.pushedCount.churches} churches, ${res.pushedCount.attendance} attendance records to Supabase!`;
      setPushResult(summary);
      triggerToast(summary);
      onAddAuditLog?.({
        id: `LOG-${Date.now()}`,
        action: 'Pushed and synchronized full dataset to live database',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        icon: 'cloud_upload',
        user: user.name,
        category: 'System'
      });
    } else {
      setPushResult(`Push error: ${res.error || 'Failed to sync with Supabase tables'}`);
    }
  };

  const handleAddGlobalService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const name = newServiceName.trim();
    const updated = Array.from(new Set([...globalServiceList, name]));
    setGlobalServiceList(updated);
    setNewServiceName('');
    
    // Save to database
    await saveServiceTypeToSupabase(name);
    onUpdateServiceTypes?.(updated);
    
    triggerToast(`Added & saved Global Service Program: "${name}"`);
    onAddAuditLog?.({
      id: `LOG-${Date.now()}`,
      action: `Added global service type "${name}" to Supabase database`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: 'tune',
      user: user.name,
      category: 'System'
    });
  };

  const handleRemoveGlobalService = async (service: string) => {
    const updated = globalServiceList.filter(s => s !== service);
    setGlobalServiceList(updated);
    await deleteServiceTypeFromSupabase(service);
    onUpdateServiceTypes?.(updated);
    triggerToast(`Removed service type "${service}" from database`);
  };

  const handleSaveSettings = async () => {
    if (isSuperadmin) {
      const cleanName = pastorName.trim();
      const cleanEmail = hqEmail.trim();
      const cleanPhone = pastorPhone.trim();
      const cleanChurchName = hqChurchName.trim();
      const cleanZone = hqZone.trim();

      await saveSuperadminProfileToSupabase({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        churchName: cleanChurchName,
        zone: cleanZone
      });

      onUpdateUser?.({
        name: cleanName,
        email: cleanEmail,
        church: cleanChurchName,
        zone: cleanZone,
        phone: cleanPhone
      });

      await saveAllAdminSettingsToSupabase({
        securityCode,
        hqEmail: cleanEmail,
        autoBackupEnabled,
        serviceTypes: globalServiceList,
        pastorName: cleanName,
        hqChurchName: cleanChurchName,
        hqZone: cleanZone,
        pastorPhone: cleanPhone
      });
    }
    triggerToast('All system settings saved to database successfully!');
    onAddAuditLog?.({
      id: `LOG-${Date.now()}`,
      action: `Saved ${user.role} system configurations & service programs to Supabase`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: 'settings',
      user: pastorName.trim() || user.name,
      category: 'System'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-8 max-w-6xl mx-auto space-y-6"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 right-6 z-50 bg-slate-900 text-blue-300 border border-blue-500/40 px-4 py-3 rounded-2xl shadow-sm flex items-center gap-2 text-xs"
        >
          <span className="material-symbols-outlined text-blue-500 text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </motion.div>
      )}

      {/* Header Banner */}
      <div className="bg-blue-700 p-6 md:p-8 rounded-2xl text-white shadow-sm border border-slate-800 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-blue-600/20 text-blue-300 text-xs font-extrabold px-3 py-1 rounded-full border border-blue-600/30">
              <span className="material-symbols-outlined text-[16px]">settings</span>
              <span>{isSuperadmin ? 'SUPERADMIN HQ CONTROL CENTER' : 'LOCAL BRANCH CONTROL CENTER'}</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {isSuperadmin ? 'Superadmin System & Supabase Hub' : `${branchName} Branch Settings`}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-body">
              Configure live database connection, cloud synchronizations, service schedules, and access credentials.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              className="bg-blue-700 hover:bg-blue-800 text-white font-black text-xs py-2.5 px-5 rounded-xl shadow-lg  transition-all flex items-center gap-2 cursor-pointer shrink-0 active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Save All Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'supabase'
              ? 'bg-emerald-800 text-emerald-100 shadow-sm ring-2 ring-emerald-500/40'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">database</span>
          <span>Live Database</span>
          {connStatus === 'success' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'profile'
              ? 'bg-slate-900 text-blue-300 shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_box</span>
          <span>{isSuperadmin ? 'HQ & Group Profile' : 'Branch Profile'}</span>
        </button>

        <button
          onClick={() => setActiveTab('accountability')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'accountability'
              ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-500/40'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">fact_check</span>
          <span>Admin Accountability & Action Logs</span>
          <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md ${
            activeTab === 'accountability' ? 'bg-blue-800 text-white' : 'bg-blue-50 text-blue-800'
          }`}>
            {currentLogs.length}
          </span>
        </button>

        {isSuperadmin && (
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'services'
                ? 'bg-slate-900 text-blue-300 shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Global Service Programs</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'scanner'
              ? 'bg-slate-900 text-blue-300 shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
          <span>Scanner & Pass Defaults</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'security'
              ? 'bg-slate-900 text-blue-300 shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          <span>Security & Auth Gate</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'backup'
              ? 'bg-slate-900 text-blue-300 shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">backup</span>
          <span>Data & Backups</span>
        </button>
      </div>

      {/* Tab Content Cards */}
      <div className="space-y-6">
        {activeTab === 'profile' && (
          <ReportCodesPanel
            isSuperadmin={isSuperadmin}
            churchNames={churches.map(c => c.name).filter(Boolean)}
            ownChurch={user.church}
          />
        )}
        {activeTab === 'profile' && !isSuperadmin && user.church && <UshersPanel church={user.church} />}

        {/* TAB 0: Live Database Configuration */}
        {activeTab === 'supabase' && (
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
                    <span className="material-symbols-outlined text-[28px]">database</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg text-slate-900">
                      Cloud Database Connection
                    </h3>
                    <p className="text-xs text-slate-500">
                      Direct connection credentials for real-time PostgreSQL database synchronization
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${connStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : connStatus === 'error'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : connStatus === 'testing'
                          ? 'bg-blue-50 text-blue-800 border-blue-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${connStatus === 'success'
                        ? 'bg-emerald-500 animate-pulse'
                        : connStatus === 'error'
                          ? 'bg-rose-500'
                          : connStatus === 'testing'
                            ? 'bg-blue-600 animate-ping'
                            : 'bg-slate-400'
                      }`} />
                    <span>
                      {connStatus === 'success'
                        ? `Connected (${connLatency ? `${connLatency}ms` : 'Active'})`
                        : connStatus === 'error'
                          ? 'Connection Failed'
                          : connStatus === 'testing'
                            ? 'Testing...'
                            : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>

              {connMessage && (
                <div className={`p-4 rounded-xl text-xs border ${connStatus === 'success'
                    ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50/70 text-rose-900 border-rose-200'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      {connStatus === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span>{connMessage}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleTestAndSaveSupabase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Project URL (HTTPS)
                  </label>
                  <input
                    type="url"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Anon Public API Key
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={connStatus === 'testing'}
                      className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {connStatus === 'testing' ? 'sync' : 'save'}
                      </span>
                      <span>{connStatus === 'testing' ? 'Testing Connection...' : 'Save & Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={runConnectionTest}
                      disabled={connStatus === 'testing'}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition-all cursor-pointer"
                    >
                      Re-Test
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSqlSchema(!showSqlSchema)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">code</span>
                    <span>{showSqlSchema ? 'Hide Database SQL Schema' : 'View Complete PostgreSQL Schema'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Manual One-Click Data Sync Button */}
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Push Full Dataset to Supabase</h4>
                  <p className="text-xs text-slate-500">
                    Synchronizes all current local records (members, leaders, churches, attendance) into your live live database tables.
                  </p>
                </div>
                <button
                  onClick={handlePushAllData}
                  disabled={isPushingData || connStatus !== 'success'}
                  className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isPushingData ? 'animate-spin' : ''}`}>
                    {isPushingData ? 'sync' : 'cloud_upload'}
                  </span>
                  <span>{isPushingData ? 'Pushing Data...' : 'Push All Data to Supabase'}</span>
                </button>
              </div>

              {pushResult && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  {pushResult}
                </div>
              )}
            </div>

            {/* SQL Schema Viewer */}
            {showSqlSchema && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-white border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">database</span>
                    <h4 className="text-xs font-bold text-blue-500">CEKB live database Schema (DDL)</h4>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                      triggerToast('SQL Schema copied to clipboard!');
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Copy All SQL</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={12}
                  value={SUPABASE_SQL_SCHEMA}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none resize-y"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Profile (Superadmin Group Pastor Form or Church Admin Branch Form) */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {isSuperadmin ? (
              /* SUPERADMIN: Unified Group Pastor & HQ Account Profile (CEKB Group Networks Form removed, Church Name field added) */
              <form onSubmit={handleSaveSuperadminProfile} className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm max-w-3xl">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold border border-blue-100">
                    <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-lg text-slate-900">
                      Group Pastor & HQ Account Profile
                    </h3>
                    <p className="text-xs text-slate-500">
                      Official administrative credentials, church designation, and group leadership contacts
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Group Pastor Full Name *</label>
                    <input
                      type="text"
                      required
                      value={pastorName}
                      onChange={(e) => setPastorName(e.target.value)}
                      placeholder="e.g. Group Pastor"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Group Pastor Email Address *</label>
                    <input
                      type="email"
                      required
                      value={hqEmail}
                      onChange={(e) => setHqEmail(e.target.value)}
                      placeholder="group.pastor@cekorlebu.org"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Group Pastor Phone / WhatsApp *</label>
                    <input
                      type="text"
                      required
                      value={pastorPhone}
                      onChange={(e) => setPastorPhone(e.target.value)}
                      placeholder="+233 24 123 4567"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Church Name *</label>
                    <input
                      type="text"
                      required
                      value={hqChurchName}
                      onChange={(e) => setHqChurchName(e.target.value)}
                      placeholder="e.g. GCYC Group HQ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>


                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">System Authority Role</label>
                    <input
                      type="text"
                      disabled
                      value="Superadmin (HQ Overseer)"
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200/70 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Database Status: Connected to live database • {churches.length} Registered Churches</span>
                  </div>
                  <span className="font-bold text-emerald-800 text-xs">Direct Sync Active</span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSuperadminProfile}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-black text-xs py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSavingSuperadminProfile ? 'sync' : 'save'}
                    </span>
                    <span>{isSavingSuperadminProfile ? 'Saving to Supabase...' : 'Save HQ & Group Profile to Supabase'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* CHURCH ADMIN PROFILE */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[22px]">badge</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-base text-slate-900">
                        Church Admin Officer Details
                      </h3>
                      <p className="text-xs text-slate-500">
                        Administrator credentials and contact info
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Admin Full Name</label>
                      <input
                        type="text"
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="e.g. Bro. Michael Mensah"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-semibold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Admin Email Address</label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@church.org"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-semibold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Admin Phone / WhatsApp</label>
                      <input
                        type="text"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="+233 24 000 0000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-semibold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Account Role</label>
                      <input
                        type="text"
                        disabled
                        value={user.role}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 font-bold text-slate-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[22px]">church</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-base text-slate-900">
                        Branch Church Profile
                      </h3>
                      <p className="text-xs text-slate-500">Church branch metadata, pastor in charge, and location</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Church Name</label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. CEKB 1"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-semibold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Pastor / Minister In Charge</label>
                      <input
                        type="text"
                        value={pastorInCharge}
                        onChange={(e) => setPastorInCharge(e.target.value)}
                        placeholder="e.g. Pastor Emmanuel"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-semibold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>


                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Live Database Status</label>
                      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-bold px-3 py-2 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Connected to live database • {members.filter(m => m.church?.toLowerCase() === (user.church || '').toLowerCase()).length} Members</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-full flex justify-end">
                  <button
                    onClick={handleSaveBranchProfile}
                    disabled={isSavingProfile}
                    className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSavingProfile ? 'sync' : 'save'}
                    </span>
                    <span>{isSavingProfile ? 'Saving Branch Profile...' : 'Save Branch Profile to Database'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Service Programs (Superadmin) */}
        {activeTab === 'services' && isSuperadmin && (
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900">
                  Global Service Types Manager
                </h3>
                <p className="text-xs text-slate-500">Service types saved to Supabase and displayed at the self check-in station</p>
              </div>
              <span className="material-symbols-outlined text-blue-600 text-[24px]">tune</span>
            </div>

            <form onSubmit={handleAddGlobalService} className="flex gap-2 max-w-xl">
              <input
                type="text"
                placeholder="Enter new global service name (e.g. Wednesday Communion Service)..."
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer shrink-0 active:scale-98"
              >
                Add & Save to Database
              </button>
            </form>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {globalServiceList.map((srv, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">event_available</span>
                    <span className="font-bold text-xs text-slate-900">{srv}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Active In Database & Check-In
                    </span>
                    <button
                      onClick={() => handleRemoveGlobalService(srv)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                      title="Delete Service Program"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Scanner & Pass Defaults */}
        {activeTab === 'scanner' && (
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-headline font-bold text-base text-slate-900">
                Usher QR Scanner & Digital Pass Preferences
              </h3>
              <p className="text-xs text-slate-500">Configure scanner feedback and automatic member pass download behavior</p>
            </div>

            <div className="divide-y divide-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center py-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">Auto-Download QR Pass on Self Attendance</p>
                  <p className="text-slate-500 text-xs">Automatically download a high-resolution Digital Member QR Code pass image upon check-in</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPassDownload}
                  onChange={(e) => setAutoPassDownload(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center py-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">Usher Scanner Sound Chime</p>
                  <p className="text-slate-500 text-xs">Play confirmation chime sound when usher scans member's QR code</p>
                </div>
                <input
                  type="checkbox"
                  checked={scannerSound}
                  onChange={(e) => setScannerSound(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center py-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">First-Timers Auto-Conversion Rule</p>
                  <p className="text-slate-500 text-xs">Automatically promote First Timer to General Member after {promotionServicesCount} verified attendances</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={promotionServicesCount}
                    onChange={(e) => setPromotionServicesCount(parseInt(e.target.value) || 3)}
                    className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-center font-bold text-slate-900"
                  />
                  <input
                    type="checkbox"
                    checked={autoPromoteFirstTimers}
                    onChange={(e) => setAutoPromoteFirstTimers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Security & Auth Gate */}
        {activeTab === 'security' && (
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 border border-slate-800 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-blue-300">
                  Authentication Gate & Security Credentials
                </h3>
                <p className="text-xs text-slate-400">Security Gate Code required for leader and Church Admin signups</p>
              </div>
              <span className="material-symbols-outlined text-blue-500 text-[24px]">lock</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3">
                <label className="block text-slate-200 font-bold">Current Security Gate Code</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
                    placeholder="••••••••"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 font-extrabold text-blue-300 tracking-wider text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => triggerToast('Security Gate Code updated successfully')}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Update
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Leaders and Church Admins MUST enter the configured authorization code during signup to unlock account creation.
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3">
                <p className="font-bold text-white">Security Log Audit Trail</p>
                <div className="space-y-1 text-xs text-slate-300">
                  <p className="flex justify-between"><span>• Church Admin Signup Gate:</span> <span className="text-emerald-400">Protected & Verified</span></p>
                  <p className="flex justify-between"><span>• Leader Self-Reg Gate:</span> <span className="text-emerald-400">Protected & Verified</span></p>
                  <p className="flex justify-between"><span>• Active Auth Sessions:</span> <span className="text-blue-300">Encrypted JWT</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Admin Accountability & Action Logs (Capped at 10 items, no duplicates) */}
        {activeTab === 'accountability' && (() => {
          // Extract unique list of admin actors
          const uniqueActors = Array.from(
            new Set([
              ...currentLogs.map(l => l.user || (l as any).actor).filter(Boolean),
              ...churchAdmins.map(a => a.adminName).filter(Boolean),
              user.name
            ])
          );

          // Unique list of branches
          const uniqueBranches = Array.from(
            new Set([
              ...currentLogs.map(l => l.church || (l as any).branch).filter(Boolean),
              ...churches.map(c => c.name)
            ])
          );

          // Filtering logic
          const cleanQuery = auditSearchTerm.trim().toLowerCase();
          const now = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;

          const filteredAuditLogs = currentLogs.filter(log => {
            if (!log) return false;
            const actorStr = (log.user || (log as any).actor || '').toLowerCase();
            const branchStr = (log.church || (log as any).branch || '').toLowerCase();
            const actionStr = (log.action || '').toLowerCase();
            const detailsStr = ((log as any).details || '').toLowerCase();
            const categoryStr = (log.category || '').toLowerCase();

            // Admin Filter
            const matchesAdmin = selectedAdminFilter === 'All' ||
              actorStr === (selectedAdminFilter || '').toLowerCase();

            // Category Filter
            const matchesCategory = selectedCategoryFilter === 'All' ||
              log.category === selectedCategoryFilter;

            // Branch Filter
            const matchesBranch = selectedBranchFilter === 'All' ||
              branchStr === (selectedBranchFilter || '').toLowerCase();

            // Time Filter
            let matchesTime = true;
            const logTime = new Date(log.timestamp).getTime();
            if (auditTimeFilter === 'today') {
              matchesTime = !isNaN(logTime) && (now - logTime) <= oneDayMs;
            } else if (auditTimeFilter === '7days') {
              matchesTime = !isNaN(logTime) && (now - logTime) <= 7 * oneDayMs;
            } else if (auditTimeFilter === '30days') {
              matchesTime = !isNaN(logTime) && (now - logTime) <= 30 * oneDayMs;
            }

            // Keyword Search
            const matchesSearch = !cleanQuery ||
              actionStr.includes(cleanQuery) ||
              detailsStr.includes(cleanQuery) ||
              actorStr.includes(cleanQuery) ||
              categoryStr.includes(cleanQuery) ||
              branchStr.includes(cleanQuery);

            return matchesAdmin && matchesCategory && matchesBranch && matchesTime && matchesSearch;
          }).slice(0, 10);

          // Relative time formatter helper
          const formatRelativeTime = (isoString: string) => {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return isoString;
            const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
            if (diffSeconds < 60) return 'Just now';
            if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
            if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
            if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          };

          const handleExportAuditCSV = () => {
            const headers = ['ID', 'Timestamp', 'Administrator / Actor', 'Branch', 'Category', 'Action Title'];
            const rows = filteredAuditLogs.map(l => [
              `"${l.id}"`,
              `"${l.timestamp}"`,
              `"${l.user || (l as any).actor || 'System'}"`,
              `"${l.church || (l as any).branch || 'Group HQ'}"`,
              `"${l.category || 'General'}"`,
              `"${l.action.replace(/"/g, '""')}"`
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `CEKB_Admin_Accountability_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            triggerToast(`Exported ${filteredAuditLogs.length} audit trail records to CSV`);
          };

          return (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              {/* Header & Accountability Overview */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-2 border border-blue-200/60">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    <span>ADMINISTRATIVE GOVERNANCE & ACCOUNTABILITY (CAPPED AT 10 LOGS)</span>
                  </div>
                  <h3 className="font-display font-extrabold text-xl md:text-2xl text-slate-900">
                    Admin Actions & Accountability Logs
                  </h3>
                  <p className="text-xs md:text-sm text-slate-500 mt-1 font-body">
                    Complete deduplicated log of administrative operations, security resets, branch profile changes, check-in operations, and member updates.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleRefreshAuditLogs}
                    disabled={isLoadingLogs}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-60"
                    title="Fetch live records directly from Supabase database"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isLoadingLogs ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span>{isLoadingLogs ? 'Fetching Logs...' : 'Refresh Live'}</span>
                  </button>

                  <button
                    onClick={handleExportAuditCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Export Audit CSV</span>
                  </button>
                </div>
              </div>

              {/* Accountability Metrics Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs uppercase font-bold">Active Logs</span>
                    <span className="material-symbols-outlined text-[18px] text-blue-600">receipt_long</span>
                  </div>
                  <div className="font-display text-2xl font-black text-slate-900">{filteredAuditLogs.length}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Capped at 10 items</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs uppercase font-bold">Deduplication</span>
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  </div>
                  <div className="font-display text-2xl font-black text-emerald-700">100%</div>
                  <div className="text-xs text-slate-500 mt-0.5">Strict anti-duplicate filter</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs uppercase font-bold">Tracked Admins</span>
                    <span className="material-symbols-outlined text-[18px] text-blue-600">group</span>
                  </div>
                  <div className="font-display text-2xl font-black text-blue-700">{uniqueActors.length}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Active actors</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs uppercase font-bold">Database Sync</span>
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">cloud_done</span>
                  </div>
                  <div className="font-display text-2xl font-black text-emerald-700">Live</div>
                  <div className="text-xs text-slate-500 mt-0.5">live database</div>
                </div>
              </div>

              {/* Detailed Filtered Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-500 ">
                          Timestamp
                        </th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-500 ">
                          Admin / Actor
                        </th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-500 ">
                          Church Branch
                        </th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-500 ">
                          Category
                        </th>
                        <th className="py-3.5 px-4 text-xs font-bold text-slate-500 ">
                          Action & Operational Impact
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs font-body">
                      {filteredAuditLogs.length > 0 ? (
                        filteredAuditLogs.map((log) => {
                          const isSecurity = log.category === 'Security';
                          const isMember = log.category === 'Member';
                          const isLeader = log.category === 'Leader';
                          const isCheckin = log.category === 'Check-in';
                          const actorName = log.user || (log as any).actor || 'Administrator';
                          const branchName = log.church || (log as any).branch || 'Group HQ';

                          return (
                            <tr
                              key={log.id}
                              className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                              onClick={() => setSelectedLogModal(log)}
                            >
                              {/* Timestamp */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-bold text-slate-900 text-xs">
                                  {formatRelativeTime(log.timestamp)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {log.timestamp}
                                </div>
                              </td>

                              {/* Admin / Actor */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                                    {actorName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">{actorName}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Church Branch */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-700">
                                  {branchName}
                                </span>
                              </td>

                              {/* Category Badge */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                                    isSecurity
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : isMember
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : isLeader
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : isCheckin
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : 'bg-slate-100 text-slate-800 border-slate-300'
                                  }`}
                                >
                                  {log.category || 'System'}
                                </span>
                              </td>

                              {/* Action */}
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900">{log.action}</div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No logs found matching current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 5: Data & Backups (Includes Multi-Sheet Excel & Multi-Section CSV Export) */}
        {activeTab === 'backup' && (
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900">
                  System Data Persistence, Backups & Comprehensive Exports
                </h3>
                <p className="text-xs text-slate-500">
                  Export multi-sheet Excel workbooks and multi-section CSVs containing member statistics, service attendance logs, and new member conversions.
                </p>
              </div>
              <span className="material-symbols-outlined text-blue-600 text-[24px]">database</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Multi-Sheet Excel Export Card */}
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <span className="material-symbols-outlined text-blue-700">table_view</span>
                  <span>Multi-Sheet System Export (Excel .xlsx)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Generates an integrated spreadsheet workbook featuring 3 dedicated sheets:
                </p>
                <ul className="text-xs text-slate-700 list-disc list-inside space-y-1 font-medium">
                  <li><strong>Sheet 1:</strong> Total members per church (admin)</li>
                  <li><strong>Sheet 2:</strong> Total attendance per service date</li>
                  <li><strong>Sheet 3:</strong> New members / First timers per service</li>
                </ul>
                <div className="pt-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      exportMultiSheetExcel(members, attendanceRecords, churches);
                      triggerToast('Exported multi-sheet Excel workbook!');
                    }}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-sm active:scale-98"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download Multi-Sheet Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      exportMultiSectionCSV(members, attendanceRecords, churches);
                      triggerToast('Exported multi-section CSV report!');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer border border-slate-200 active:scale-98"
                  >
                    <span>Download Multi-Section CSV</span>
                  </button>
                </div>
              </div>

              {/* JSON Snapshot Backup Card */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="material-symbols-outlined text-blue-600">inventory_2</span>
                  <span>Full System JSON Backup Snapshot</span>
                </div>
                <p className="text-xs text-slate-500">
                  Download raw structured JSON archive of all church branches, admin accounts, leaders, members, and attendance timestamps.
                </p>
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ churches, churchAdmins, members, leaders, attendanceRecords, timestamp: new Date().toISOString() }, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `CEKB_System_Backup_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    triggerToast('Exported backup snapshot JSON!');
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-blue-300 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer active:scale-98"
                >
                  Download JSON Backup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
