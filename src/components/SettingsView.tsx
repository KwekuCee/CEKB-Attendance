import { csvQ } from '../utils/csvSafe';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PasswordInput } from './PasswordInput';
import { motion } from 'motion/react';
import { UserProfile, AuthSessionUser, ChurchBranch, SettingsTab, AuditLogItem, Member, Leader, AttendanceRecord, ChurchAdminAccount } from '../types';
import {
  saveChurchToSupabase,
  saveChurchAdminToSupabase,
  fetchAuditLogsFromSupabase,
  saveSuperadminProfileToSupabase,
  fetchSuperadminProfileFromSupabase,
  saveAllAdminSettingsToSupabase,
  saveServiceTypeToSupabase,
  deleteServiceTypeFromSupabase,
  fetchServiceTypesFromSupabase,
  getStoredSession,
  saveStoredSession,
  uploadProfilePhoto,
  getProfilePhotoFolder,
  updateProfilePhotoInSupabase
} from '../lib/supabaseService';
import { exportMultiSheetExcel, exportMultiSectionCSV } from '../utils/exportUtils';
import { ReportCodesPanel } from './ReportCodesPanel';
import { UshersPanel } from './UshersPanel';
import { Button } from './Button';
import { rawPortal } from '../lib/rawPortal';
import { estimateSmsCost } from '../lib/smsPricing';
import { MemberPhoto } from './MemberPhoto';

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
  settingsTab: SettingsTab;
  onAddAuditLog?: (log: AuditLogItem) => void;
  onUpdateUser?: (updated: Partial<AuthSessionUser>) => void;
  onStartPageTour?: () => void;
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
  settingsTab,
  onAddAuditLog,
  onUpdateUser,
  onStartPageTour
}) => {
  const isSuperadmin = user.role === 'Superadmin';
  const activeTab = settingsTab;

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

  // Find matching Church Branch and Admin records
  const matchingChurch = churches.find(
    c => (c?.name || '').toLowerCase() === (user?.church || '').toLowerCase()
  );
  const matchingAdmin = churchAdmins.find(
    a => (a?.churchName || '').toLowerCase() === (user?.church || '').toLowerCase() ||
      (a?.adminName || '').toLowerCase() === (user?.name || '').toLowerCase()
  );

  // Superadmin Profile states
  const [pastorName, setPastorName] = useState(user.name || '');
  const [hqEmail, setHqEmail] = useState(user.email || '');
  const [pastorPhone, setPastorPhone] = useState(user.phone || '');
  const [hqChurchName, setHqChurchName] = useState(user.church || '');
  const [hqZone, setHqZone] = useState(user.zone || '');
  const [isSavingSuperadminProfile, setIsSavingSuperadminProfile] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    (user as AuthSessionUser).avatar || (user as UserProfile).avatarUrl || '',
  );
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const profilePhotoInput = useRef<HTMLInputElement>(null);

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
  const [pastorInCharge, setPastorInCharge] = useState(matchingChurch?.pastor || '');
  const [adminFullName, setAdminFullName] = useState(matchingAdmin?.adminName || user.name || '');
  const [adminEmail, setAdminEmail] = useState(matchingAdmin?.adminEmail || user.email || '');
  const [adminPhone, setAdminPhone] = useState(matchingAdmin?.adminPhone || user.phone || '');
  const [adminZone, setAdminZone] = useState(matchingChurch?.zone || matchingAdmin?.zone || user.zone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [scannerSound, setScannerSound] = useState(true);
  const [scannerVibrate, setScannerVibrate] = useState(true);
  const [autoPassDownload, setAutoPassDownload] = useState(true);
  const [autoPromoteFirstTimers, setAutoPromoteFirstTimers] = useState(true);
  const [promotionServicesCount, setPromotionServicesCount] = useState(3);

  // Load Superadmin Profile from Supabase on mount
  useEffect(() => {
    if (isSuperadmin) {
      fetchSuperadminProfileFromSupabase(user.email).then(prof => {
        if (prof) {
          if (prof.name) setPastorName(prof.name);
          if (prof.email) setHqEmail(prof.email);
          if (prof.phone) setPastorPhone(prof.phone);
          if (prof.churchName) setHqChurchName(prof.churchName);
          if (prof.zone) setHqZone(prof.zone);
          if (prof.photoUrl) setProfilePhotoUrl(prof.photoUrl);
        }
      }).catch(() => {});
    }
  }, [isSuperadmin, user.email]);

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
  const canSendAdminSms = isSuperadmin || user.role === 'Church Admin' || (user.role as string) === 'Church Pastor';
  const canChangeProfilePhoto = isSuperadmin || user.role === 'Church Admin' || (user.role as string) === 'Church Pastor';

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleProfilePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      triggerToast('Choose an image smaller than 5 MB.');
      return;
    }
    if (!user.email) {
      triggerToast('This account has no email address for photo authorization.');
      return;
    }

    setIsUploadingProfilePhoto(true);
    try {
      const folder = await getProfilePhotoFolder(user.email);
      const path = await uploadProfilePhoto(folder, file);
      if (!path) {
        triggerToast('Profile photo upload failed. Please try again.');
        return;
      }
      const saved = await updateProfilePhotoInSupabase(path);
      if (!saved) {
        triggerToast('Photo uploaded but could not be linked to your account. Please retry.');
        return;
      }
      setProfilePhotoUrl(path);
      onUpdateUser?.({ avatar: path });
      const session = getStoredSession();
      if (session) saveStoredSession({ ...session, avatar: path });
      triggerToast('Profile photo updated.');
    } catch (error) {
      console.error('Profile photo update failed:', error);
      triggerToast('Profile photo could not be updated.');
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  };

  const profilePhotoControl = (
    <div className="flex items-center gap-4">
      <MemberPhoto
        photoUrl={profilePhotoUrl}
        initials={user.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'A'}
        size={56}
        className="rounded-full"
      />
      <div className="space-y-1.5">
        <input
          ref={profilePhotoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
          className="hidden"
          onChange={handleProfilePhotoSelection}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={isUploadingProfilePhoto}
          onClick={() => profilePhotoInput.current?.click()}
        >
          {isUploadingProfilePhoto ? 'Uploading…' : 'Change profile photo'}
        </Button>
        <p className="text-[11px] text-slate-500">Image files up to 5 MB.</p>
      </div>
    </div>
  );

  const handleSaveSuperadminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSuperadminProfile(true);
    const cleanName = pastorName.trim();
    const cleanEmail = hqEmail.trim();
    const cleanPhone = pastorPhone.trim();
    const cleanChurchName = hqChurchName.trim();
    const cleanZone = hqZone.trim();

    try {
      const saved = await saveSuperadminProfileToSupabase({
        id: user.id,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        churchName: cleanChurchName,
        zone: cleanZone,
        photoUrl: profilePhotoUrl,
      });
      if (!saved) {
        triggerToast('Could not save the Group Pastor profile. Please retry.');
        return;
      }

      onUpdateUser?.({
        name: cleanName,
        email: cleanEmail,
        church: cleanChurchName,
        zone: cleanZone,
        phone: cleanPhone,
        avatar: profilePhotoUrl,
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
      triggerToast('Could not save the Group Pastor profile. Please retry.');
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

      const saved = await saveSuperadminProfileToSupabase({
        id: user.id,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        churchName: cleanChurchName,
        zone: cleanZone,
        photoUrl: profilePhotoUrl,
      });
      if (!saved) {
        triggerToast('Could not save the Group Pastor profile. Please retry.');
        return;
      }

      onUpdateUser?.({
        name: cleanName,
        email: cleanEmail,
        church: cleanChurchName,
        zone: cleanZone,
        phone: cleanPhone,
        avatar: profilePhotoUrl,
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
              {isSuperadmin ? 'Superadmin System Settings' : `${branchName} Branch Settings`}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-body">
              Manage account profiles, messaging, security, and church administration preferences.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onStartPageTour && (
              <button
                onClick={onStartPageTour}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 active:scale-98"
                title="Tour this page step-by-step"
              >
                <span className="material-symbols-outlined text-[17px]">tour</span>
                <span>Tour Page</span>
              </button>
            )}

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

      {/* Tab Content Cards */}
      <div data-tour="settings-tabs" className="space-y-6">
        {activeTab === 'messaging' && canSendAdminSms && <AdminSmsUpdates user={user} />}
        {activeTab === 'messaging' && (['Superadmin', 'Church Admin', 'Church Pastor'] as string[]).includes(user.role) && (
          <SenderSmsWorkspace />
        )}
        {activeTab === 'profile' && (
          <ReportCodesPanel
            isSuperadmin={isSuperadmin}
            churchNames={churches.map(c => c.name).filter(Boolean)}
            ownChurch={user.church}
          />
        )}
        {activeTab === 'profile' && !isSuperadmin && user.church && <UshersPanel church={user.church} canAppointAdmins={(user.role as string) === 'Church Pastor'} />}

        {activeTab === 'ushers' && (
          <UshersPanel church={user.church || churches[0]?.name || ''} canAppointAdmins={(user.role as string) === 'Church Pastor'} />
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

                <div className="pb-4 border-b border-slate-100">
                  {canChangeProfilePhoto && profilePhotoControl}
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
                      placeholder="name@example.com"
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
                    <span>{churches.length} Registered Churches</span>
                  </div>
                  <span className="font-bold text-emerald-800 text-xs">Group profile</span>
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
                    <div className="pb-3 border-b border-slate-100">
                      {canChangeProfilePhoto && profilePhotoControl}
                    </div>
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
                      <label className="block text-slate-700 font-semibold mb-1">Member Records</label>
                      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-bold px-3 py-2 rounded-xl">
                        <span>{members.filter(m => m.church?.toLowerCase() === (user.church || '').toLowerCase()).length} members registered</span>
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
                  <PasswordInput
                    
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

        {/* Activity log records are deduplicated and limited to the latest 10. */}
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
              csvQ(l.id),
              csvQ(l.timestamp),
              csvQ(l.user || (l as any).actor || 'System'),
              csvQ(l.church || (l as any).branch || 'Group HQ'),
              csvQ(l.category || 'General'),
              csvQ(l.action)
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
                    <span>ADMINISTRATIVE ACTIVITY (LATEST 10 LOGS)</span>
                  </div>
                  <h3 className="font-display font-extrabold text-xl md:text-2xl text-slate-900">
                    Activity Logs
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
                    <span className="text-xs uppercase font-bold">Data Sync</span>
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">cloud_done</span>
                  </div>
                  <div className="font-display text-2xl font-black text-emerald-700">Active</div>
                  <div className="text-xs text-slate-500 mt-0.5">Application records</div>
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
                  Export one group summary sheet and one aggregate analytics sheet per church. Exports contain totals only, not member-level records.
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
                  Generates an aggregate workbook with a group overview followed by one detailed worksheet per registered church:
                </p>
                <ul className="text-xs text-slate-700 list-disc list-inside space-y-1 font-medium">
                  <li>Attendance, absentee, first-timer, and leader totals</li>
                  <li>Church growth by month and leader type</li>
                  <li>Attendance history and peak check-in times</li>
                  <li>No member names or contact details</li>
                </ul>
                <div className="pt-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const inScope = (church: string) => isSuperadmin || church.toLowerCase() === user.church.toLowerCase();
                      const reportData = {
                        members: members.filter(member => inScope(member.church)),
                        attendanceRecords: attendanceRecords.filter(record => inScope(record.church)),
                        churches: churches.filter(church => inScope(church.name)),
                        churchAdmins: churchAdmins.filter(admin => inScope(admin.churchName)),
                        leaders: leaders.filter(leader => inScope(leader.church)),
                      };
                      exportMultiSheetExcel(reportData, isSuperadmin ? 'CEKB_Group_Aggregate_Report' : 'CEKB_Church_Aggregate_Report');
                      triggerToast('Exported multi-sheet Excel workbook!');
                    }}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-sm active:scale-98"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download Multi-Sheet Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      const inScope = (church: string) => isSuperadmin || church.toLowerCase() === user.church.toLowerCase();
                      exportMultiSectionCSV({
                        members: members.filter(member => inScope(member.church)),
                        attendanceRecords: attendanceRecords.filter(record => inScope(record.church)),
                        churches: churches.filter(church => inScope(church.name)),
                        churchAdmins: churchAdmins.filter(admin => inScope(admin.churchName)),
                        leaders: leaders.filter(leader => inScope(leader.church)),
                      });
                      triggerToast('Exported aggregate CSV report!');
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

function AdminSmsUpdates({ user }: { user: UserProfile | AuthSessionUser }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await rawPortal({ action: 'sendAdminSms', message: message.trim() });
      if (!response?.success) {
        setError(response?.error?.message || response?.error || 'Could not send the admin update.');
        setResult(response?.sms || null);
      } else {
        setResult(response.sms);
        setMessage('');
      }
    } catch {
      setError('Could not reach the SMS service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const scope = user.role === 'Superadmin' ? 'all churches' : user.church;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-headline font-bold">SMS updates for Church Admins</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a message to verified Church Admin accounts {scope ? `in ${scope}` : 'in your church'}. Recipients and phone numbers are selected by the server; arbitrary numbers cannot be targeted.
        </p>
      </div>
      <form onSubmit={send} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Update message</span>
          <textarea
            value={message}
            rows={4}
            maxLength={1000}
            required
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            placeholder="Write a short update for the church administrators…"
          />
          <span className="block text-right text-xs text-muted-foreground">{message.length}/1,000 characters</span>
        </label>
        <Button type="submit" disabled={busy || !message.trim()}>
          <span className="material-symbols-outlined mr-1 text-base" aria-hidden="true">send</span>
          {busy ? 'Sending…' : 'Send admin update'}
        </Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && (
        <p role="status" className="rounded-xl bg-muted/60 p-3 text-sm">
          mNotify accepted {result.accepted || 0}; failed {result.failed || 0}; skipped without a valid phone {result.skippedNoPhone || 0}. Credits used: {result.creditsUsed || 0}.
          {result.creditsLeft !== null && result.creditsLeft !== undefined ? ` Credits left: ${result.creditsLeft}.` : ''}
          {result.warning ? ` ${result.warning}` : ''}
          {result.error ? ` ${result.error}` : ''}
          {' '}Acceptance is not a final handset delivery receipt.
        </p>
      )}
    </section>
  );
}

function SenderSmsWorkspace() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [senderName, setSenderName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [editingId, setEditingId] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState('All');
  const [campaignPage, setCampaignPage] = useState(1);
  const [deliveryPages, setDeliveryPages] = useState<Record<string, number>>({});
  const pendingSend = useRef<{ fingerprint: string; key: string } | null>(null);
  const [audience, setAudience] = useState<'custom' | 'leaders' | 'members' | 'all'>('custom');
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string; kind: 'member' | 'leader'; code: string | null }>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [codeKind, setCodeKind] = useState<'member' | 'leader'>('member');
  const [codePicked, setCodePicked] = useState<Set<string>>(new Set());
  const [codeSearch, setCodeSearch] = useState('');

  useEffect(() => {
    void rawPortal({ action: 'mnotifyUser', op: 'contacts' }).then((r: any) => { if (r?.success) setContacts(r.contacts || []); });
  }, []);

  const load = async () => {
    const result = await rawPortal({ action: 'mnotifyUser', op: 'dashboard' });
    if (result?.success) {
      setDashboard(result);
      const approved = (result.senderIds || []).find((item: any) => item.status === 'verified');
      if (approved && !selectedSenderId) setSelectedSenderId(approved.id);
    } else {
      setError(result?.error?.message || 'Could not load your SMS dashboard.');
    }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const recipientResult = useMemo(() => {
    const found = new Set<string>();
    const invalid: string[] = [];
    for (const input of recipients.split(/[\s,;]+/)) {
      if (!input) continue;
      if (!/^\+?[\d().-]+$/.test(input)) {
        invalid.push(input);
        continue;
      }
      const digits = input.replace(/\D/g, '');
      const local = digits.startsWith('233') && digits.length === 12 ? `0${digits.slice(3)}` : digits;
      if (/^0\d{9}$/.test(local)) found.add(local);
      else invalid.push(input);
    }
    return { valid: [...found], invalid };
  }, [recipients]);
  const validRecipients = useMemo(() => {
    if (audience === 'custom') {
      const set = new Set(recipientResult.valid);
      contacts.forEach((c) => { if (picked.has(`${c.kind}:${c.id}`)) set.add(c.phone); });
      return [...set];
    }
    return [...new Set(contacts.filter((c) => audience === 'all' || (audience === 'leaders' ? c.kind === 'leader' : c.kind === 'member')).map((c) => c.phone))];
  }, [audience, recipientResult.valid, contacts, picked]);
  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };
  const sendCodes = async () => {
    if (!selectedSenderId) return;
    const ids = [...codePicked];
    const label = ids.length ? `${ids.length} selected ${codeKind}(s)` : `all ${codeKind}s with a phone number`;
    if (!window.confirm(`Send each person their ${codeKind} code by SMS to ${label}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await rawPortal({ action: 'mnotifyUser', op: 'sendCodes', kind: codeKind, ids: ids.length ? ids : undefined, senderIdRequestId: selectedSenderId });
      if (result?.success) {
        setNotice(`Codes sent: ${result.accepted} accepted, ${result.failed} failed. Credits used: ${result.creditsUsed}.${result.error ? ` ${result.error.message || result.error}` : ''}`);
        setCodePicked(new Set());
      }
      else setError(result?.error?.message || 'Codes were not sent.');
    } catch { setError('Could not reach the SMS service.'); } finally { setBusy(false); }
  };
  const estimate = estimateSmsCost(message, validRecipients.length, Number(dashboard?.unitRate || 0));
  const verifiedSenders = (dashboard?.senderIds || []).filter((item: any) => item.status === 'verified');

  const submitSender = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await rawPortal({
        action: 'mnotifyUser',
        op: 'submitSenderId',
        id: editingId || undefined,
        senderName,
        purpose,
      });
      if (!result?.success) {
        setError(result?.error?.message || 'Could not submit the Sender ID request.');
      } else {
        setNotice(result.providerAccepted
          ? `Sender ID submitted to mNotify. Admin alert: ${result.alertStatus}.`
          : `Your request was saved, but mNotify submission failed. ${result.senderId?.submission_error || ''} Admin alert: ${result.alertStatus}.`);
        setEditingId('');
        setSenderName('');
        setPurpose('');
        await load();
      }
    } catch {
      setError('Could not reach the SMS service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const refreshSender = async (id: string) => {
    setBusy(true);
    setError('');
    const result = await rawPortal({ action: 'mnotifyUser', op: 'refreshSenderId', id });
    if (result?.success) {
      setNotice(result.pending ? 'mNotify still reports this Sender ID as pending.' : `Sender ID status: ${result.status}.`);
      await load();
    } else setError(result?.error?.message || 'Could not refresh approval status.');
    setBusy(false);
  };

  const sendSms = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSenderId || !message.trim() || !validRecipients.length) return;
    const confirmMessage =
      `${validRecipients.length} recipient(s), ${estimate.pagesPerMessage} page(s) each, ${estimate.totalPages} total pages, estimated ${estimate.estimatedCost} credits. Continue?`;
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const fingerprint = `${selectedSenderId}|${audience}|${message.trim()}|${validRecipients.join(',')}`;
      if (!pendingSend.current || pendingSend.current.fingerprint !== fingerprint) {
        pendingSend.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await rawPortal({
        action: 'mnotifyUser',
        op: 'sendSms',
        senderIdRequestId: selectedSenderId,
        audience,
        recipients: audience === 'custom' ? validRecipients : [],
        message: message.trim(),
        idempotencyKey: pendingSend.current.key,
      });
      if (!result?.success) {
        setError(result?.error?.message || result?.error || 'SMS was not accepted.');
      } else {
        pendingSend.current = null;
        setNotice(result.duplicate
          ? `This send request was already submitted and was not sent twice. Current campaign status: ${result.status}.`
          : `mNotify accepted ${result.accepted} message(s), failed ${result.failed}. Actual credits used: ${result.creditsUsed}. Delivery receipts may update after sending.`);
        setMessage('');
        setRecipients('');
        setPicked(new Set());
        await load();
      }
    } catch {
      setError('Could not reach the SMS service. Check campaign history before retrying.');
    } finally {
      setBusy(false);
    }
  };

  const refreshCampaign = async (id: string) => {
    setBusy(true);
    const result = await rawPortal({ action: 'mnotifyUser', op: 'refreshCampaign', id });
    if (result?.success) {
      setNotice(`Delivery report refreshed: ${result.counts.delivered} delivered, ${result.counts.failed} failed, ${result.counts.pending} pending.`);
      await load();
    } else setError(result?.error?.message || 'Could not fetch the delivery report.');
    setBusy(false);
  };

  const exportRecipients = (campaign: any) => {
    const recipientsToExport = (campaign.recipients || []).filter((row: any) => deliveryFilter === 'All' || row.status === deliveryFilter);
    const rows = [['Recipient', 'Status', 'Failure reason'], ...recipientsToExport.map((row: any) => [row.recipient_phone, row.status, row.failure_reason || ''])];
    const csv = rows.map((row) => row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.href = url;
    link.download = `sms-delivery-${campaign.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-headline font-bold">Sender IDs & SMS</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a Sender ID with its purpose, track approval, then send SMS with a live page and cost estimate.
        </p>
      </div>

      <form onSubmit={submitSender} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] items-end">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Sender ID</span>
          <input
            required
            maxLength={11}
            pattern="[A-Za-z0-9 ]{1,11}"
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            placeholder="Up to 11 letters, digits, spaces"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Purpose (at least 30 characters)</span>
          <textarea
            required
            minLength={30}
            maxLength={1000}
            rows={2}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            placeholder="Explain what messages you plan to send using this ID."
          />
        </label>
        <Button type="submit" disabled={busy || purpose.trim().length < 30}>
          {busy ? 'Submitting…' : editingId ? 'Resubmit request' : 'Register Sender ID'}
        </Button>
      </form>

      {dashboard?.senderIds?.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Your Sender ID requests</h3>
          {dashboard.senderIds.map((sender: any) => (
            <div key={sender.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <strong>{sender.sender_name}</strong>
                <p className="text-xs text-muted-foreground">{sender.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  Status: {sender.status}{sender.submission_error ? ` · ${sender.submission_error}` : ''}{sender.rejection_reason ? ` · ${sender.rejection_reason}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {['submitted', 'pending'].includes(sender.status) && (
                  <Button variant="secondary" disabled={busy} onClick={() => void refreshSender(sender.id)}>Refresh status</Button>
                )}
                {['failed', 'rejected'].includes(sender.status) && (
                  <Button variant="secondary" onClick={() => {
                    setEditingId(sender.id);
                    setSenderName(sender.sender_name);
                    setPurpose(sender.purpose);
                  }}>Edit & resubmit</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {verifiedSenders.length > 0 && (
        <>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            Select your approved Sender ID on the SMS form. Sender IDs may be up to 11 characters. GSM-7 messages use 160 characters per first page and 153 per additional page; Unicode uses 70/67. Do not send spam or content against mNotify terms.
          </div>
          <form onSubmit={sendSms} className="space-y-3">
            <h3 className="font-semibold">Send an SMS</h3>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Verified Sender ID</span>
              <select value={selectedSenderId} onChange={(event) => setSelectedSenderId(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {verifiedSenders.map((sender: any) => <option key={sender.id} value={sender.id}>{sender.sender_name}</option>)}
              </select>
            </label>
            <div className="space-y-2">
              <span className="text-sm font-semibold">Send to</span>
              <div className="flex flex-wrap gap-2">
                {([['custom', 'Selected brethren'], ['leaders', 'All leaders'], ['members', 'All members'], ['all', 'All leaders & members']] as const).map(([value, label]) => (
                  <Button key={value} type="button" variant={audience === value ? 'primary' as any : 'secondary'} onClick={() => setAudience(value)}>{label}</Button>
                ))}
              </div>
              {audience === 'custom' ? (
                <>
                  <input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search leaders and members by name" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                  <div className="max-h-56 overflow-auto rounded-xl border border-border divide-y divide-border">
                    {contacts.filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 300).map((c) => (
                      <label key={`${c.kind}:${c.id}`} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={picked.has(`${c.kind}:${c.id}`)} onChange={() => toggle(picked, `${c.kind}:${c.id}`, setPicked)} />
                        <span className="flex-1">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.kind === 'leader' ? 'Leader' : 'Member'} · {c.phone}</span>
                      </label>
                    ))}
                    {contacts.length === 0 && <p className="p-3 text-xs text-muted-foreground">No leaders or members with phone numbers yet.</p>}
                  </div>
                  <textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Or type numbers saved on your church records: 0241234567, +233201234567" />
                  {recipientResult.invalid.length > 0 && <span className="block text-xs text-destructive">Invalid number(s): {recipientResult.invalid.slice(0, 10).join(', ')}</span>}
                </>
              ) : null}
              <span className="block text-xs text-muted-foreground">{validRecipients.length} unique recipient(s).{validRecipients.length > 3000 ? ' A campaign is limited to 3,000.' : ''}</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={1000} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <span className="text-xs text-muted-foreground">
                {estimate.characters} {estimate.encoding} units · {estimate.pagesPerMessage} page(s) per recipient · {estimate.totalPages} total pages · estimated {dashboard?.unitRate ? estimate.estimatedCost : 'rate not configured'} credits
              </span>
            </label>
            {validRecipients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Select a recipient audience or choose members/leaders from the church directory before sending.
              </p>
            )}
            <Button type="submit" disabled={busy || !selectedSenderId || !message.trim() || !validRecipients.length || (audience === 'custom' && recipientResult.invalid.length > 0) || validRecipients.length > 3000 || !dashboard?.unitRate}>
              {busy ? 'Sending…' : 'Review cost & send'}
            </Button>
          </form>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="font-semibold">Send member or leader codes</h3>
            <p className="text-xs text-muted-foreground">Each person receives their own code by SMS from your selected Sender ID. Leave everyone unticked to send to all.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={codeKind === 'member' ? 'primary' as any : 'secondary'} onClick={() => { setCodeKind('member'); setCodePicked(new Set()); }}>Member codes</Button>
              <Button type="button" variant={codeKind === 'leader' ? 'primary' as any : 'secondary'} onClick={() => { setCodeKind('leader'); setCodePicked(new Set()); }}>Leader codes</Button>
            </div>
            <input value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="Search by name" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
            <div className="max-h-56 overflow-auto rounded-xl border border-border divide-y divide-border">
              {contacts.filter((c) => c.kind === codeKind && c.code && c.name.toLowerCase().includes(codeSearch.toLowerCase())).slice(0, 300).map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={codePicked.has(c.id)} onChange={() => toggle(codePicked, c.id, setCodePicked)} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.code}</span>
                </label>
              ))}
            </div>
            <Button type="button" disabled={busy || !selectedSenderId} onClick={() => void sendCodes()}>
              {busy ? 'Sending…' : codePicked.size ? `Send codes to ${codePicked.size} selected` : `Send codes to all ${codeKind}s`}
            </Button>
          </div>
        </>
      )}

      {(dashboard?.campaigns || []).length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">SMS campaign and delivery history</h3>
            <label className="flex items-center gap-2 text-xs">
              <span>Recipient status</span>
              <select
                value={deliveryFilter}
                onChange={(event) => {
                  setDeliveryFilter(event.target.value);
                  setDeliveryPages({});
                }}
                className="rounded-lg border border-input bg-background px-2 py-1"
              >
                <option>All</option><option value="delivered">Delivered</option><option value="failed">Failed</option><option value="pending">Pending</option>
              </select>
            </label>
          </div>
          {dashboard.campaigns.slice((campaignPage - 1) * 10, campaignPage * 10).map((campaign: any) => {
            const filteredRecipients = (campaign.recipients || []).filter((recipient: any) => deliveryFilter === 'All' || recipient.status === deliveryFilter);
            const recipientPages = Math.max(1, Math.ceil(filteredRecipients.length / 10));
            const recipientPage = Math.min(deliveryPages[campaign.id] || 1, recipientPages);
            const visibleRecipients = filteredRecipients.slice((recipientPage - 1) * 10, recipientPage * 10);
            return (
            <details key={campaign.id} className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer flex flex-wrap justify-between gap-2 text-sm">
                <span>{campaign.sender_name} · {new Date(campaign.created_at).toLocaleString()}</span>
                <span>{campaign.status} · {campaign.recipient_count} recipient(s) · {(campaign.recipients || []).filter((r: any) => r.status === 'delivered').length} delivered / {(campaign.recipients || []).filter((r: any) => r.status === 'failed').length} failed / {(campaign.recipients || []).filter((r: any) => r.status === 'pending').length} pending · estimate {Number(campaign.unit_rate) > 0 ? `${campaign.estimated_cost} credits` : 'unavailable'} · actual {campaign.actual_credits ?? 'pending'} credits</span>
              </summary>
              <p className="my-2 whitespace-pre-wrap text-sm">{campaign.message}</p>
              <div className="flex flex-wrap gap-2">
                {campaign.provider_campaign_id && <Button variant="secondary" disabled={busy} onClick={() => void refreshCampaign(campaign.id)}>Refresh delivery status</Button>}
                <Button variant="secondary" onClick={() => exportRecipients(campaign)}>Export recipients CSV</Button>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr><th className="p-2">Recipient</th><th className="p-2">Status</th><th className="p-2">Failure reason</th></tr></thead>
                  <tbody>{visibleRecipients.map((recipient: any) => (
                    <tr key={recipient.recipient_phone} className="border-t border-border">
                      <td className="p-2">{recipient.recipient_phone}</td><td className="p-2">{recipient.status}</td><td className="p-2">{recipient.failure_reason || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {recipientPages > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span>Delivery records {(recipientPage - 1) * 10 + 1}–{Math.min(recipientPage * 10, filteredRecipients.length)} of {filteredRecipients.length}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={recipientPage <= 1} onClick={() => setDeliveryPages((pages) => ({ ...pages, [campaign.id]: recipientPage - 1 }))}>Previous</Button>
                    <Button variant="secondary" disabled={recipientPage >= recipientPages} onClick={() => setDeliveryPages((pages) => ({ ...pages, [campaign.id]: recipientPage + 1 }))}>Next</Button>
                  </div>
                </div>
              )}
            </details>
            );
          })}
          {dashboard.campaigns.length > 10 && (
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>Campaigns {(campaignPage - 1) * 10 + 1}–{Math.min(campaignPage * 10, dashboard.campaigns.length)} of {dashboard.campaigns.length}</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={campaignPage <= 1} onClick={() => setCampaignPage((page) => Math.max(1, page - 1))}>Previous</Button>
                <Button variant="secondary" disabled={campaignPage >= Math.ceil(dashboard.campaigns.length / 10)} onClick={() => setCampaignPage((page) => page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {notice && <p role="status" className="rounded-xl bg-muted/60 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
