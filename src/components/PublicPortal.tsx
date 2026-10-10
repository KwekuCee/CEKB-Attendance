import React, { useState, useMemo, useEffect } from 'react';
import { PasswordInput } from './PasswordInput';
import { renderQrPass, saveQrPass, QrPassResult, SaveOutcome } from '../utils/qrPass';
import { motion } from 'motion/react';
import { Member, Leader, ChurchBranch, ChurchAdminAccount, AttendanceRecord, AuthSessionUser } from '../types';
import { getSupabase } from '../lib/supabase';
import { FOUNDATION_SCHOOL_CLASSES, STANDARD_SERVICE_TYPES, parseFoundationClassNumber, getFoundationClassLabel } from '../data/constants';
import { clearStoredSession, authenticateUserWithDatabase, sendPasswordResetEmail, fetchServiceTypesFromSupabase, sendAttendanceEmailToChurchAdmin, uploadMemberPhoto, uploadProfilePhoto, sendAdminVerificationEmail, syncLeaderAsMember, generateLeaderCode, sendQrPassEmails } from '../lib/supabaseService';
import { ChurchLogo } from './ChurchLogo';
import { HeroSection } from './HeroSection';
import { Button } from './Button';
import { CellReportForm } from './CellReportForm';
import { rawPortal } from '../lib/rawPortal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PublicPortalProps {
  members: Member[];
  leaders: Leader[];
  churches: ChurchBranch[];
  churchAdmins?: ChurchAdminAccount[];
  serviceTypes?: Array<{ id: string; name: string; active?: boolean }> | string[];
  onConfirmAttendance: (record: AttendanceRecord) => void;
  onAddLeader: (leader: Leader) => void;
  onAddChurchAdmin: (admin: ChurchAdminAccount, branch: ChurchBranch) => void;
  onLoginSuccess: (userRole?: AuthSessionUser['role'], userChurch?: string, adminName?: string, userEmail?: string) => void;
  onAddMember: (member: Member) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  members,
  leaders,
  churches,
  churchAdmins = [],
  serviceTypes = [],
  onConfirmAttendance,
  onAddLeader,
  onAddChurchAdmin,
  onLoginSuccess,
  onAddMember,
}) => {
  // A dedicated /cell-report address opens the weekly report sheet straight away,
  // so a subdomain can be pointed at it for leaders.
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'leader_reg' | 'admin_signup' | 'login' | 'cell_report'>(
    () => (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/cell-report' ? 'cell_report' : (new URLSearchParams(window.location.search).has('signin') ? 'login' : 'home'))
  );
  const { isInstalled: isPWAInstalled, openPromptBox } = usePWAInstall();

  // Dynamically derive effective list of churches from DB and registered admins
  const effectiveChurches = useMemo(() => {
    const map = new Map<string, ChurchBranch>();

    // 1. Add database churches
    (churches || []).forEach(c => {
      if (c && c.name) map.set(c.name.toLowerCase(), c);
    });

    // 3. Add any registered Church Admin accounts' churches
    (churchAdmins || []).forEach(a => {
      if (a && a.churchName) {
        const key = a.churchName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: `CH-ADM-${a.id || Date.now()}`,
            name: a.churchName,
            pastor: a.adminName || 'Pastor in Charge',
            membersCount: 0,
            status: 'Healthy',
            zone: a.zone || 'Zone 1 (Korle Bu)',
            pcfCount: 0,
            cellCount: 0,
            bsctCount: 0
          });
        }
      }
    });

    return Array.from(map.values());
  }, [churches, churchAdmins]);

  // Leader self-registration offers every church branch registered on the
  // platform (created when a church admin signs up), read live from the
  // database so new branches show up straight away.
  const adminRegisteredChurches = useMemo(() => {
    const map = new Map<string, ChurchBranch>();
    (churches || []).forEach(c => {
      if (c && c.name) map.set(c.name.toLowerCase(), c);
    });
    (churchAdmins || []).forEach(a => {
      if (a && a.churchName) {
        const key = a.churchName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: `CH-ADM-${a.id || Date.now()}`,
            name: a.churchName,
            pastor: a.adminName || 'Pastor in Charge',
            membersCount: 0,
            status: 'Healthy',
            zone: a.zone || 'Zone 1 (Korle Bu)',
            pcfCount: 0,
            cellCount: 0,
            bsctCount: 0
          });
        }
      }
    });
    return Array.from(map.values());
  }, [churches, churchAdmins]);

  // Dynamic service types list from props and database
  const [dbServiceTypes, setDbServiceTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchServiceTypesFromSupabase().then(types => {
      if (types && types.length > 0) {
        setDbServiceTypes(types);
      }
    }).catch(() => {});
  }, []);

  const effectiveServiceTypes = useMemo(() => {
    const rawList: string[] = [];
    if (Array.isArray(serviceTypes) && serviceTypes.length > 0) {
      serviceTypes.forEach(s => {
        if (typeof s === 'string') rawList.push(s);
        else if (s && s.name && (s.active !== false)) rawList.push(s.name);
      });
    }
    if (dbServiceTypes.length > 0) {
      dbServiceTypes.forEach(s => rawList.push(s));
    }
    STANDARD_SERVICE_TYPES.forEach(s => rawList.push(s));
    return Array.from(new Set(rawList.filter(Boolean)));
  }, [serviceTypes, dbServiceTypes]);

  // --- 1. Self Attendance State ---
  const [attFullName, setAttFullName] = useState('');
  const [attEmail, setAttEmail] = useState('');
  const [attPhone, setAttPhone] = useState('');
  const [attDob, setAttDob] = useState('');
  const [attLocation, setAttLocation] = useState('Korle Bu, Accra');
  const [attOccupation, setAttOccupation] = useState('Student');
  const [attOtherOccupation, setAttOtherOccupation] = useState('');
  const [attEducation, setAttEducation] = useState('Tertiary / University');
  const [attOtherEducation, setAttOtherEducation] = useState('');
  const [attGender, setAttGender] = useState<'Male' | 'Female'>('Male');
  const [attMaritalStatus, setAttMaritalStatus] = useState('Single');
  const [attPhotoFile, setAttPhotoFile] = useState<File | null>(null);
  const [attPhotoPreview, setAttPhotoPreview] = useState('');
  const [attFoundationClass, setAttFoundationClass] = useState('Class 1: The New Creation');
  const [attInvitedByLeaderId, setAttInvitedByLeaderId] = useState('self_invite');
  const [attChurch, setAttChurch] = useState(effectiveChurches[0]?.name || '');
  const [attServiceType, setAttServiceType] = useState('Sunday Service');
  const [attSearchQuery, setAttSearchQuery] = useState('');
  const [attSuccessPass, setAttSuccessPass] = useState<AttendanceRecord | null>(null);
  const [attPassImageDataUrl, setAttPassImageDataUrl] = useState('');
  const [passFile, setPassFile] = useState<QrPassResult | null>(null);
  const [passSaveOutcome, setPassSaveOutcome] = useState<SaveOutcome | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

  // Auto-fill church when leader is chosen
  const handleInvitedByChange = (leaderId: string) => {
    setAttInvitedByLeaderId(leaderId);
    if (leaderId !== 'self_invite') {
      const foundLeader = leaders.find(l => l.id === leaderId);
      if (foundLeader && foundLeader.church) {
        setAttChurch(foundLeader.church);
      }
    }
  };

  // --- 2. Leader Self-Registration State ---
  const [ldrName, setLdrName] = useState('');
  const [ldrEmail, setLdrEmail] = useState('');
  const [ldrPhone, setLdrPhone] = useState('');
  const [ldrCellName, setLdrCellName] = useState('');
  const [ldrDob, setLdrDob] = useState('');
  const [ldrLocation, setLdrLocation] = useState('');
  const [ldrRole, setLdrRole] = useState<'BSCT' | 'Cell Leader' | 'PCF Leader' | 'Church Coordinator'>('Cell Leader');
  const [ldrChurch, setLdrChurch] = useState(adminRegisteredChurches[0]?.name || '');
  const [ldrPhotoFile, setLdrPhotoFile] = useState<File | null>(null);
  const [ldrPhotoPreview, setLdrPhotoPreview] = useState('');
  const [ldrAuthCode, setLdrAuthCode] = useState('');
  const [ldrPassword, setLdrPassword] = useState('');
  const [ldrError, setLdrError] = useState('');
  const [ldrSuccessMsg, setLdrSuccessMsg] = useState('');
  const [isSubmittingLeader, setIsSubmittingLeader] = useState(false);

  // Keep church selections synced when effectiveChurches updates
  useEffect(() => {
    if (effectiveChurches.length > 0) {
      const attExists = effectiveChurches.some(c => c?.name && attChurch && c.name.toLowerCase() === attChurch.toLowerCase());
      if (!attExists || !attChurch) {
        setAttChurch(effectiveChurches[0].name);
      }
    }
    if (adminRegisteredChurches.length > 0) {
      const ldrExists = adminRegisteredChurches.some(c => c?.name && ldrChurch && c.name.toLowerCase() === ldrChurch.toLowerCase());
      if (!ldrExists || !ldrChurch) {
        setLdrChurch(adminRegisteredChurches[0].name);
      }
    } else if (ldrChurch) {
      setLdrChurch('');
    }
  }, [effectiveChurches, adminRegisteredChurches]);

  // --- 3. Church Admin Sign Up State ---
  const [admFullName, setAdmFullName] = useState('');
  const [admRequiredEmail, setAdmRequiredEmail] = useState('');
  const [admChurchName, setAdmChurchName] = useState('');
  const [admPastorName, setAdmPastorName] = useState('');
  const [admPhone, setAdmPhone] = useState('');
  const [admPassword, setAdmPassword] = useState('');
  const [admPhotoFile, setAdmPhotoFile] = useState<File | null>(null);
  const [admPhotoPreview, setAdmPhotoPreview] = useState('');
  const [admAuthCode, setAdmAuthCode] = useState('');
  const [admError, setAdmError] = useState('');
  const [admSuccessMsg, setAdmSuccessMsg] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // --- 4. Admin Sign In State ---
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await sendPasswordResetEmail(resetEmail.trim());
      if (res.success) {
        setResetFeedback({ type: 'success', message: res.message });
        setResetLink(res.link || null);
      } else {
        setResetFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setResetFeedback({ type: 'error', message: err?.message || 'Failed to dispatch reset link.' });
    } finally {
      setIsResetting(false);
    }
  };

  // Filtered members for attendance search
  const cleanAttSearch = (attSearchQuery || '').trim().toLowerCase();
  const filteredMembers = cleanAttSearch
    ? members.filter(
      (m) => {
        if (!m) return false;
        const nameStr = (m.fullName || '').toLowerCase();
        const idStr = (m.id || '').toLowerCase();
        const phoneStr = m.phone || '';
        return nameStr.includes(cleanAttSearch) || phoneStr.includes(cleanAttSearch) || idStr.includes(cleanAttSearch);
      }
    ).slice(0, 5)
    : [];

  const generateAndDownloadQrPass = async (member: Member, churchName: string, serviceType: string, timestamp: string) => {
    try {
      setIsGeneratingQr(true);
      const pass = await renderQrPass(member, churchName, serviceType, timestamp);
      setAttPassImageDataUrl(pass.dataUrl);
      setPassFile(pass);
      const outcome = await saveQrPass(pass, `CEKB_QR_Pass_${member.id}.png`);
      setPassSaveOutcome(outcome);
      setIsGeneratingQr(false);
      return pass.dataUrl;
    } catch (err) {
      console.error('Error generating QR pass:', err);
      setIsGeneratingQr(false);
      return '';
    }
  };


  // Handlers
  const handleSelfAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAttendance) return;
    if (!attFullName.trim() || !attPhone.trim()) {
      alert('Please fill in your Full Name and Contact Phone Number.');
      return;
    }
    setIsSubmittingAttendance(true);
    try {

    // Determine invitedBy name
    let invitedByName = 'Self-Walkin / Self Invited';
    if (attInvitedByLeaderId !== 'self_invite') {
      const foundL = leaders.find((l) => l.id === attInvitedByLeaderId);
      if (foundL) {
        invitedByName = foundL.fullName;
      }
    }

    // Resolve occupation (support custom occupation if "Other" is selected)
    const resolvedOccupation = attOccupation === 'Other'
      ? (attOtherOccupation.trim() || 'Other')
      : attOccupation;

    const resolvedEducation = attEducation === 'Other'
      ? (attOtherEducation.trim() || 'Other')
      : attEducation;

    const foundationClassNum = parseFoundationClassNumber(attFoundationClass);

    // Check if member already exists by name & phone
    const normalizedInputName = (attFullName || '').trim().toLowerCase();
    const normalizedInputPhone = (attPhone || '').trim();
    let existingMember = members.find(
      (m) => m && ((m.fullName || '').toLowerCase() === normalizedInputName || (m.phone && m.phone === normalizedInputPhone))
    );

    if (!existingMember) {
      existingMember = {
        id: `CE-${Math.floor(1000 + Math.random() * 9000)}`,
        fullName: attFullName.trim(),
        phone: attPhone.trim(),
        email: attEmail.trim() || undefined,
        dob: attDob || undefined,
        role: 'Member',
        occupation: resolvedOccupation,
        education: resolvedEducation,
        gender: attGender,
        maritalStatus: attMaritalStatus,
        location: attLocation,
        church: attChurch,
        invitedBy: invitedByName,
        invitedByLeaderId: attInvitedByLeaderId !== 'self_invite' ? attInvitedByLeaderId : undefined,
        joinDate: new Date().toISOString().slice(0, 10),
        initials: (attFullName || 'Member').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'MB',
        serviceCount: 1,
        foundationClass: foundationClassNum,
        status: 'General Member',
      };
      if (attPhotoFile) {
        const storedPath = await uploadMemberPhoto(existingMember.id, attPhotoFile);
        if (storedPath) existingMember.photoUrl = storedPath;
      }
      onAddMember(existingMember);
    } else {
      // Update existing member's location, occupation, education, and foundation class
      existingMember.location = attLocation;
      existingMember.occupation = resolvedOccupation;
      existingMember.education = resolvedEducation;
      existingMember.gender = attGender;
      existingMember.maritalStatus = attMaritalStatus;
      existingMember.foundationClass = foundationClassNum;
      if (attPhotoFile) {
        const storedPath = await uploadMemberPhoto(existingMember.id, attPhotoFile);
        if (storedPath) existingMember.photoUrl = storedPath;
      }
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const record: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      memberId: existingMember.id,
      memberName: existingMember.fullName,
      memberRole: existingMember.role,
      serviceType: attServiceType,
      timestamp,
      date: new Date().toISOString().slice(0, 10),
      verifiedBy: 'Self Check-In Portal',
      status: 'Confirmed',
      church: attChurch,
      checkInMethod: 'Self Check-In',
      leaderName: invitedByName || existingMember.invitedBy || 'Direct / Self',
      pcfName: invitedByName ? `${invitedByName}'s Cell / PCF` : 'General PCF'
    };

    onConfirmAttendance(record);
    setAttSuccessPass(record);

    // Auto-generate and download QR pass
    const passDataUrl = await generateAndDownloadQrPass(existingMember, attChurch, attServiceType, timestamp);

    // Best-effort notify the church admin by email; never block the UI on this.
    sendAttendanceEmailToChurchAdmin({
      churchName: attChurch,
      memberName: existingMember.fullName,
      memberId: existingMember.id,
      serviceType: attServiceType,
      timestamp,
      qrPassBase64: passDataUrl || undefined,
    }).catch(() => {});

    // Always leave a copy in the attendee's own inbox when they gave an email.
    if (existingMember.email) {
      sendQrPassEmails([
        {
          id: existingMember.id,
          name: existingMember.fullName,
          email: existingMember.email,
          church: attChurch,
        },
      ]).catch(() => {});
    }
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleLeaderSelfReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingLeader) return;
    setLdrError('');
    setLdrSuccessMsg('');

    // REQUIRED AUTH CODE VALIDATION
    if (ldrAuthCode.trim().toUpperCase() !== 'YOM26') {
      setLdrError('Invalid Authentication Code! Please enter a valid security code.');
      return;
    }

    if (!ldrName.trim() || !ldrPhone.trim() || !ldrCellName.trim() || !ldrEmail.trim()) {
      setLdrError('Please complete all required fields including Full Name, Email, Contact, and Cell/PCF Names.');
      return;
    }
    if (ldrPassword.length < 8) {
      setLdrError('Please choose a password with at least 8 characters for your leader account.');
      return;
    }

    setIsSubmittingLeader(true);
    try {
    let leaderPhotoPath: string | undefined;
    if (ldrPhotoFile) {
      leaderPhotoPath = (await uploadProfilePhoto(`leaders/${ldrEmail.trim().toLowerCase() || Date.now()}`, ldrPhotoFile)) || undefined;
    }

    const leaderCode = generateLeaderCode();

    const newLeader: Leader = {
      id: leaderCode,
      leaderCode,
      photoUrl: leaderPhotoPath,
      fullName: ldrName.trim(),
      email: ldrEmail.trim(),
      contact: ldrPhone.trim(),
      dob: ldrDob || '1995-01-01',
      location: ldrLocation || 'Accra',
      leaderType: ldrRole,
      cellOrPcfName: ldrCellName.trim(),
      church: ldrChurch,
      isAppointed: false,
      downstreamCount: 0,
      promotionStatus: 'Confirmed',
      joinedDate: new Date().toISOString().slice(0, 10),
      initials: (ldrName || 'Leader').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'LD',
    };

    onAddLeader(newLeader);

    // Each leader gets their own sign-in so they can follow their group.
    let accountNote = ' You can now sign in with your email and password.';
    const accountClient: any = getSupabase();
    if (accountClient) {
      const email = newLeader.email.trim().toLowerCase();
      const { error: accErr } = await accountClient.from('user_profiles').insert({
        username: email, email, full_name: newLeader.fullName, password_hash: ldrPassword,
        role: 'Leader', church_name: newLeader.church, phone: newLeader.contact,
      });
      if (accErr) accountNote = ` Your leader account could not be created (${accErr.message}).`;
    }

    // Every leader is also a member: keep the membership records in step and
    // tag them with their leader role.
    const memberId = (await syncLeaderAsMember(newLeader)) || leaderCode;

    // Give the leader their own scan pass so the branch admin can record
    // their attendance the same way as any member.
    const leaderAsMember: Member = {
      id: memberId,
      fullName: newLeader.fullName,
      phone: newLeader.contact,
      email: newLeader.email,
      dob: newLeader.dob,
      role: 'Leader',
      occupation: 'General',
      education: 'Tertiary',
      location: newLeader.location,
      church: newLeader.church,
      invitedBy: newLeader.parentLeaderName || 'Leader Registration',
      joinDate: newLeader.joinedDate,
      initials: newLeader.initials,
      serviceCount: 0,
      foundationClass: 7,
      status: 'General Member',
      photoUrl: newLeader.photoUrl,
    };
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await generateAndDownloadQrPass(leaderAsMember, newLeader.church, `${newLeader.leaderType} Pass`, timestamp);

    if (newLeader.email) {
      sendQrPassEmails([
        {
          id: memberId,
          name: newLeader.fullName,
          email: newLeader.email,
          church: newLeader.church,
          role: newLeader.leaderType,
        },
      ]).catch(() => {});
    }

    setLdrSuccessMsg(`Registration complete for ${newLeader.fullName} (${newLeader.leaderType} - ${newLeader.church}). Leader code: ${leaderCode}. Your scan pass has been downloaded — show it to your branch admin at every service.${accountNote}`);
    setLdrName('');
    setLdrEmail('');
    setLdrPhone('');
    setLdrCellName('');
    setLdrLocation('');
    setLdrPhotoFile(null);
    setLdrPhotoPreview('');
    setLdrAuthCode('');
    setLdrPassword('');
    } finally {
      setIsSubmittingLeader(false);
    }
  };

  const handleAdminSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAdmin) return;
    setAdmError('');
    setAdmSuccessMsg('');

    // REQUIRED AUTH CODE VALIDATION — the group pastor code is checked on the server.
    const enteredCode = admAuthCode.trim().toUpperCase();
    let isGroupPastorCode = false;
    if (enteredCode !== 'YOM26') {
      const check = await rawPortal({ action: 'checkGroupCode', code: enteredCode });
      isGroupPastorCode = !!check?.valid;
      if (!isGroupPastorCode) {
        setAdmError('Invalid Authentication Code! Please enter a valid security code.');
        return;
      }
    }

    if (
      !admFullName.trim() ||
      !admRequiredEmail.trim() ||
      !admChurchName.trim() ||
      !admPhone.trim()
    ) {
      setAdmError('Please complete all required fields for Church Branch Admin signup.');
      return;
    }

    if (admPassword.trim().length < 8) {
      setAdmError('Please choose a password with at least 8 characters.');
      return;
    }

    setIsSubmittingAdmin(true);
    try {
    const newBranch: ChurchBranch = {
      id: `CH-${Date.now().toString().slice(-4)}`,
      name: admChurchName.trim(),
      pastor: admFullName.trim(),
      membersCount: 0,
      status: 'Growing',
      zone: 'Zone 1 (Korle Bu)',
      pcfCount: 0,
      cellCount: 0,
      bsctCount: 0,
    };

    let adminPhotoPath: string | undefined;
    if (admPhotoFile) {
      adminPhotoPath = (await uploadProfilePhoto(`admins/${admRequiredEmail.trim().toLowerCase()}`, admPhotoFile)) || undefined;
    }

    const newAdmin: ChurchAdminAccount = {
      photoUrl: adminPhotoPath,
      id: `ADM-${Math.floor(100 + Math.random() * 900)}`,
      adminName: admFullName.trim(),
      adminEmail: admRequiredEmail.trim(),
      adminPhone: admPhone.trim(),
      churchName: admChurchName.trim(),
      zone: 'Zone 1 (Korle Bu)',
      joinedDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      password: admPassword.trim(),
      accountRole: 'Church Pastor'
    };

    await onAddChurchAdmin(newAdmin, newBranch);
    if (isGroupPastorCode) {
      let claimed = false;
      for (let i = 0; i < 5 && !claimed; i++) {
        const r = await rawPortal({ action: 'claimGroupPastor', code: enteredCode, email: newAdmin.adminEmail });
        claimed = !!r?.success;
        if (!claimed) await new Promise((res) => setTimeout(res, 1200));
      }
      if (!claimed) {
        setAdmError('Your church was created, but the group pastor appointment did not complete. Please contact support.');
      }
    }
    setAdmSuccessMsg(`Church "${newBranch.name}" and the pastor account for "${newAdmin.adminName}" were created. We are sending a confirmation link to ${newAdmin.adminEmail}…`);

    const res = await sendAdminVerificationEmail(newAdmin.adminEmail, newAdmin.adminName, true);
    setAdmSuccessMsg(
      res.success
        ? `Almost done! We sent a confirmation link to ${newAdmin.adminEmail}. Open it to confirm your email, then sign in. The link lasts 24 hours.`
        : `Your account was created, but we could not send the confirmation email (${res.message}). Use "Resend confirmation" on the sign-in page.`
    );
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInfo, setOtpInfo] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setUnverifiedEmail('');
    setVerifyFeedback('');
    setIsLoggingIn(true);

    try {
      const result = await authenticateUserWithDatabase(
        loginIdentifier,
        loginPassword,
        undefined,
        churchAdmins,
        churches,
        otpCode || undefined
      );

      if (!result.success || !result.user) {
        if (result.error === 'otp_required') {
          setOtpStep(true); setOtpCode('');
          setLoginError('');
          setOtpInfo(`We emailed a 6-digit sign-in code to ${(result as any).otpEmail || 'your email'}. Enter it below.`);
        } else if (result.error === 'otp_invalid') {
          setLoginError('That code is not right. Check the email and try again.');
        } else if ((result.error || '') === 'email_unverified') {
          setUnverifiedEmail(loginIdentifier.trim());
          setLoginError('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
        } else {
          setLoginError(result.error || 'Authentication failed. Please verify your credentials and try again.');
        }
        setIsLoggingIn(false);
        return;
      }

      // The account's role (returned by the server) decides where the user lands.
      onLoginSuccess(
        result.user.role,
        result.user.church,
        result.user.name,
        result.user.email
      );
    } catch (err: any) {
      setLoginError(err?.message || 'Database connection error during authentication. Please retry.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setIsResendingVerify(true);
    setVerifyFeedback('');
    const res = await sendAdminVerificationEmail(unverifiedEmail);
    setVerifyFeedback(res.message);
    setIsResendingVerify(false);
  };

  return (
    <div className="public-portal min-h-screen bg-background text-foreground font-body relative overflow-x-hidden flex flex-col" data-portal-view={activeTab}>
      <header className="portal-header">
        <Button variant="ghost" className="portal-brand" onClick={() => setActiveTab('home')} aria-label="CEKB Group home">
          <ChurchLogo className="portal-logo" alt="CEKB Logo" />
          <span><strong>CEKB Group</strong><small>Christ Embassy Korle Bu</small></span>
        </Button>
        <nav className="portal-header-links" aria-label="Main navigation">
          <Button variant="ghost" onClick={() => setActiveTab('attendance')}>Attendance</Button>
          <Button variant="ghost" onClick={() => setActiveTab('cell_report')}>Cell reports</Button>
        </nav>
        <div className="flex items-center gap-2">
          {!isPWAInstalled && (
            <Button variant="secondary" aria-label="Install App" onClick={openPromptBox}>
              <span className="material-symbols-outlined">install_mobile</span>
              <span className="hidden sm:inline">Get App</span>
            </Button>
          )}
          <Button variant="secondary" className="portal-signin" aria-label="Sign In" onClick={() => setActiveTab('login')}>
            <span className="material-symbols-outlined">login</span><span>Sign In</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`portal-main flex-1 w-full mx-auto ${activeTab === 'home' ? 'portal-main--home' : 'portal-main--form'}`}>
        {/* HOMEPAGE HERO — shown only on the landing tab */}
        {activeTab === 'home' && (
          <HeroSection onNavigate={(tab) => { setActiveTab(tab); if (tab === 'attendance') setAttSuccessPass(null); }} />
        )}

        {/* Action Tabs Switcher — hidden on the hero landing page */}
        {activeTab !== 'home' && (
          <div className="portal-flow-navigation">
            <Button variant="ghost" className="portal-back" onClick={() => { setActiveTab('home'); setAttSuccessPass(null); }}>
              <span className="material-symbols-outlined">arrow_back</span> Home
            </Button>
            <div className="portal-flow-intro">
              <span className="portal-flow-mark material-symbols-outlined">analytics</span>
              <p>CEKB attendance system</p>
              <h2>People, services and growth in one place.</h2>
              <span>Every name is a person. Every gathering is an opportunity to grow together in faith.</span>
            </div>
            <nav className="portal-flow-tabs" aria-label="Church services">
              {([
                ['attendance', 'Attendance', 'how_to_reg'],
                ['leader_reg', 'Leader Sign Up', 'person_add'],
                ['admin_signup', 'Register a Church', 'church'],
                ['cell_report', 'Cell Report', 'assignment'],
                ['login', 'Sign In', 'lock'],
              ] as const).map(([tab, label, icon]) => (
                <Button key={tab} variant="ghost" aria-label={label} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => { setActiveTab(tab); if (tab === 'attendance') setAttSuccessPass(null); }}>
                  <span className="portal-tab-icon material-symbols-outlined">{icon}</span><span>{label}</span><span className="portal-tab-arrow material-symbols-outlined">arrow_forward</span>
                </Button>
              ))}
            </nav>
            <div className="portal-page-heading">
              <span className="portal-page-icon material-symbols-outlined">{({ attendance: 'how_to_reg', leader_reg: 'diversity_3', admin_signup: 'church', cell_report: 'assignment', login: 'lock', home: 'church' })[activeTab]}</span>
              <div>
                <p className="portal-page-eyebrow">CEKB Group</p>
                <h1>{({ attendance: 'Check in to your church', leader_reg: 'Leader registration', admin_signup: 'Register your church', cell_report: 'Weekly cell report', login: 'Welcome back', home: 'CEKB Group' })[activeTab]}</h1>
                <p>{({ attendance: "Join us for today’s service.", leader_reg: 'Your church. Your cell. Your calling.', admin_signup: 'The church pastor creates the church account.', cell_report: 'Cell meetings, attendance and soulwinning.', login: 'Sign in to your account.', home: '' })[activeTab]}</p>
              </div>
            </div>
          </div>
        )}

        {/* WEEKLY CELL REPORT SHEET (access code protected) */}
        {activeTab === 'cell_report' && (
          <CellReportForm
            churchOptions={adminRegisteredChurches.map(c => c.name).filter(Boolean)}
            leaders={leaders}
          />
        )}

        {/* TAB 1: SELF ATTENDANCE RECORDING */}
        {activeTab === 'attendance' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
                <span className="material-symbols-outlined text-[24px]">fact_check</span>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">Check in to your church</h3>
                <p className="text-xs text-slate-500">
                  Mark your attendance for today's service in your local church branch.
                </p>
              </div>
            </div>

            {attSuccessPass ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-blue-50/50 border border-blue-200 rounded-2xl p-6 text-center space-y-5 shadow-xs"
              >
                <div className="w-16 h-16 bg-blue-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-700/20">
                  <span className="material-symbols-outlined text-[36px]">verified</span>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded-full border border-blue-300 mb-2">
                    <span className="material-symbols-outlined text-[14px]">
                      {passSaveOutcome === 'shared' || passSaveOutcome === 'downloaded' ? 'download_done' : 'qr_code_2'}
                    </span>
                    <span>
                      {passSaveOutcome === 'shared' || passSaveOutcome === 'downloaded'
                        ? 'QR CODE SAVED TO YOUR DEVICE'
                        : 'QR CODE READY — SAVE IT BELOW'}
                    </span>
                  </div>
                  <h4 className="font-display font-extrabold text-2xl text-slate-900">
                    Attendance Confirmed!
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    God bless you for coming to church, <span className="font-bold text-slate-900">{attSuccessPass.memberName}</span>!{' '}
                    {passSaveOutcome === 'shared' || passSaveOutcome === 'downloaded'
                      ? 'Your personal Digital Attendance Pass QR Code has been saved to your device.'
                      : 'Save your personal Digital Attendance Pass below — press and hold the image, or tap Save Pass.'}
                  </p>

                </div>

                {/* QR Pass Preview Card */}
                {attPassImageDataUrl && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                    <p className="text-xs font-bold text-slate-500 uppercase">Your Digital Member Pass</p>
                    <img
                      src={attPassImageDataUrl}
                      alt="Digital Member QR Pass"
                      className="max-w-[280px] mx-auto rounded-xl border border-blue-200 shadow-sm"
                    />
                    <p className="text-xs text-slate-500 italic">
                      Show this QR Code to the usher on your phone or print out every time you attend church for fast scan!
                    </p>
                    <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-2.5 font-semibold">
                      On iPhone: press and hold the pass above, then choose <strong>Save to Photos</strong>. You can also tap
                      Save Pass below to use the share sheet.
                    </p>
                    {passSaveOutcome === 'failed' && (
                      <p className="text-xs text-rose-600 font-semibold">
                        Your browser blocked the automatic save — please press and hold the image to save it.
                      </p>
                    )}

                  </div>
                )}

                <div className="bg-white p-4 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 shadow-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Member ID:</span>
                    <span className="text-blue-700 font-bold">{attSuccessPass.memberId}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Church Branch:</span>
                    <span className="text-slate-900 font-semibold">{attSuccessPass.church}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Service Program:</span>
                    <span className="text-slate-900 font-semibold">{attSuccessPass.serviceType}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Check-In Time:</span>
                    <span className="text-slate-900 font-semibold">{attSuccessPass.timestamp}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={async () => {
                      if (passFile) {
                        const outcome = await saveQrPass(
                          passFile,
                          `CEKB_QR_Pass_${attSuccessPass.memberId}.png`
                        );
                        setPassSaveOutcome(outcome);
                      }
                    }}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-700/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Save Pass to My Phone</span>
                  </button>


                  <button
                    onClick={() => {
                      setAttSuccessPass(null);
                      setAttFullName('');
                      setAttEmail('');
                      setAttPhone('');
                      setAttDob('');
                      setAttPassImageDataUrl('');
                      setPassFile(null);
                      setPassSaveOutcome(null);

                      setAttInvitedByLeaderId('self_invite');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs py-3 px-5 rounded-xl cursor-pointer"
                  >
                    Record Another Attendee
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSelfAttendanceSubmit} className="space-y-4">
                <h4 className="portal-form-section">Personal details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kwame Mensah"
                      value={attFullName}
                      onChange={(e) => setAttFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Contact / Phone *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+233 24 000 0000"
                      value={attPhone}
                      onChange={(e) => setAttPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="kwame@example.com"
                      value={attEmail}
                      onChange={(e) => setAttEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Date of Birth (DOB)
                    </label>
                    <input
                      type="date"
                      value={attDob}
                      onChange={(e) => setAttDob(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Gender *
                    </label>
                    <select
                      value={attGender}
                      onChange={(e) => setAttGender(e.target.value as 'Male' | 'Female')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Marital Status *
                    </label>
                    <select
                      value={attMaritalStatus}
                      onChange={(e) => setAttMaritalStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Engaged">Engaged</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                </div>

                {/* Optional photo */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Profile Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {attPhotoPreview ? (
                      <img src={attPhotoPreview} alt="Selected profile photo" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[22px]">person</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAttPhotoFile(file);
                        setAttPhotoPreview(file ? URL.createObjectURL(file) : '');
                      }}
                      className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-800 file:text-xs file:font-bold cursor-pointer"
                    />
                  </div>
                </div>

                {/* Location, Occupation, Educational Level, Foundation Class */}
                <h4 className="portal-form-section">About you</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Location / Area *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. your area or suburb"
                      value={attLocation}
                      onChange={(e) => setAttLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Occupation *
                    </label>
                    <select
                      value={attOccupation}
                      onChange={(e) => setAttOccupation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    >
                      <option value="Student">Student</option>
                      <option value="Software Developer / Engineer">Software Developer / Engineer</option>
                      <option value="Nurse / Medical Practitioner">Nurse / Medical Practitioner</option>
                      <option value="Teacher / Educator">Teacher / Educator</option>
                      <option value="Trader / Business Owner">Trader / Business Owner</option>
                      <option value="Banker / Finance">Banker / Finance</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Civil Servant">Civil Servant</option>
                      <option value="Artisan / Craftsman">Artisan / Craftsman</option>
                      <option value="Other">Other (Specify below)</option>
                    </select>

                    {attOccupation === 'Other' && (
                      <div className="mt-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                          Specify Your Occupation *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Legal Counsel, Architect, Fashion Designer"
                          value={attOtherOccupation}
                          onChange={(e) => setAttOtherOccupation(e.target.value)}
                          className="w-full bg-blue-50/60 border border-blue-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Educational Level *
                    </label>
                    <select
                      value={attEducation}
                      onChange={(e) => setAttEducation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    >
                      <option value="Tertiary / University">Tertiary / University Degree</option>
                      <option value="High School / SHS">High School / SHS</option>
                      <option value="Postgraduate / Masters">Postgraduate / Masters / Doctorate</option>
                      <option value="Professional Certificate">Professional Certificate</option>
                      <option value="Basic Education / JHS">Basic Education / JHS</option>
                      <option value="Other">Other (Specify below)</option>
                    </select>

                    {attEducation === 'Other' && (
                      <div className="mt-2.5">
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                          Specify Your Educational Level *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Vocational Training, Apprenticeship"
                          value={attOtherEducation}
                          onChange={(e) => setAttOtherEducation(e.target.value)}
                          className="w-full bg-blue-50/60 border border-blue-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Foundation School Class *
                    </label>
                    <select
                      value={attFoundationClass}
                      onChange={(e) => setAttFoundationClass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-blue-700 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    >
                      <option value="Class 1: The New Creation">Class 1: The New Creation</option>
                      <option value="Class 2: The Holy Spirit">Class 2: The Holy Spirit</option>
                      <option value="Class 3: Christian Doctrine">Class 3: Christian Doctrine</option>
                      <option value="Class 4: Evangelism & Cell Ministry">Class 4: Evangelism & Cell Ministry</option>
                      <option value="Class 5: Christian Character & Prosperity">Class 5: Christian Character & Prosperity</option>
                      <option value="Class 6: The Local Assembly & Loveworld">Class 6: The Local Assembly & Loveworld</option>
                      <option value="Class 7: Introduction to Mobile Technology as a Platform for Advancing the Gospel">Class 7: Introduction to Mobile Technology as a Platform for Advancing the Gospel</option>
                      <option value="Graduated">Graduated (All 7 Classes Completed)</option>
                      <option value="Not Enrolled Yet">Not Enrolled Yet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Church Branch Selection (first — leaders below are filtered by it) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Select Your Church *
                    </label>
                    <select
                      value={attChurch}
                      onChange={(e) => { setAttChurch(e.target.value); setAttInvitedByLeaderId('self_invite'); }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-blue-900 font-bold outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                    >
                      {effectiveChurches.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Leader / Inviter Selection — selected church first, then every other branch */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Who Invited You / Name of Leader? *
                    </label>
                    {(() => {
                      // Only leaders registered in the selected church are shown.
                      const churchLeaders = leaders.filter(
                        (ldr) => attChurch && (ldr.church || '').toLowerCase() === attChurch.toLowerCase()
                      );
                      return (
                        <>
                          <select
                            value={attInvitedByLeaderId}
                            onChange={(e) => handleInvitedByChange(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                          >
                            <option value="self_invite">Self Invited / Walk-In</option>
                            {churchLeaders.map((ldr) => (
                              <option key={ldr.id} value={ldr.id}>
                                {ldr.fullName} ({ldr.leaderType})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500 mt-1">
                            {churchLeaders.length === 0
                              ? `No leaders registered for ${attChurch || 'this church'} yet — choose Self Invited / Walk-In.`
                              : `Only leaders registered at ${attChurch} are listed.`}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                </div>

                {/* Service Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Service Type *
                  </label>
                  <select
                    value={attServiceType}
                    onChange={(e) => setAttServiceType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  >
                    {effectiveServiceTypes.map((srv) => (
                      <option key={srv} value={srv}>
                        {srv}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={isGeneratingQr || isSubmittingAttendance}
                  className="w-full mt-4"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  <span>{isGeneratingQr || isSubmittingAttendance ? 'Recording attendance…' : 'Confirm Attendance & Download Digital QR Pass'}</span>
                </Button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: LEADER SELF-REGISTRATION */}
        {activeTab === 'leader_reg' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="material-symbols-outlined text-[24px]">military_tech</span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Self Leader Registration</h3>
                  <p className="text-xs text-slate-500">
                    Register as a BSCT, Cell Leader, PCF Leader, or Church Coordinator.
                  </p>
                </div>
              </div>

            </div>

            {ldrSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                <span>{ldrSuccessMsg}</span>
              </div>
            )}

            {ldrSuccessMsg && attPassImageDataUrl && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm text-center">
                <p className="text-xs font-bold text-slate-500 uppercase">Your Leader Scan Pass</p>
                <img
                  src={attPassImageDataUrl}
                  alt="Leader QR Pass"
                  className="max-w-[280px] mx-auto rounded-xl border border-blue-200 shadow-sm"
                />
                <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-2.5 font-semibold text-left">
                  On iPhone: press and hold the pass above and choose <strong>Save to Photos</strong>, or tap Save Pass below.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (passFile) {
                      const outcome = await saveQrPass(passFile, 'CEKB_Leader_Pass.png');
                      setPassSaveOutcome(outcome);
                    }
                  }}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Save Pass to My Phone</span>
                </button>
                {passSaveOutcome === 'failed' && (
                  <p className="text-xs text-rose-600 font-semibold">
                    Your browser blocked the automatic save — please press and hold the image to save it.
                  </p>
                )}
              </div>
            )}


            {ldrError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-rose-600">error</span>
                <span>{ldrError}</span>
              </div>
            )}

            <form onSubmit={handleLeaderSelfReg} className="space-y-4">
              <h4 className="portal-form-section">Leader details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Full Names *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deacon Kwame Asamoah"
                    value={ldrName}
                    onChange={(e) => setLdrName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="kasamoah@cekorlebu.org"
                    value={ldrEmail}
                    onChange={(e) => setLdrEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+233 24 123 4567"
                    value={ldrPhone}
                    onChange={(e) => setLdrPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Cell or PCF Names *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Glorious Cell 1 / Grace PCF"
                    value={ldrCellName}
                    onChange={(e) => setLdrCellName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Profile Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {ldrPhotoPreview ? (
                      <img src={ldrPhotoPreview} alt="Selected profile photo" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[22px]">person</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setLdrPhotoFile(file);
                        setLdrPhotoPreview(file ? URL.createObjectURL(file) : '');
                      }}
                      className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-800 file:text-xs file:font-bold cursor-pointer"
                    />
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={ldrDob}
                    onChange={(e) => setLdrDob(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Korle Bu, Accra"
                    value={ldrLocation}
                    onChange={(e) => setLdrLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Type of Leader *
                  </label>
                  <select
                    value={ldrRole}
                    onChange={(e) => setLdrRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  >
                    <option value="BSCT">BSCT (Bible Study Class Teacher)</option>
                    <option value="Cell Leader">Cell Leader</option>
                    <option value="PCF Leader">PCF Leader</option>
                    <option value="Church Coordinator">Church Coordinator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Select Your Church *
                  </label>
                  <select
                    value={ldrChurch}
                    onChange={(e) => setLdrChurch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                    disabled={adminRegisteredChurches.length === 0}
                  >
                    {adminRegisteredChurches.length === 0 && (
                      <option value="">No church branches registered yet</option>
                    )}
                    {adminRegisteredChurches.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account password *</label>
                <PasswordInput
                  required
                  placeholder="At least 8 characters"
                  value={ldrPassword}
                  onChange={(e) => setLdrPassword(e.target.value)}
                  aria-label="Leader account password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                />
                <p className="text-xs text-slate-500 mt-1">Use your email and this password to sign in and follow your group's attendance.</p>
              </div>

              {/* AUTH CODE REQUIREMENT - CLEAN EMPTY PLACEHOLDER */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <label className="block text-xs font-black text-blue-800 ">
                  Authentication Code Required *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-[18px]">
                    key
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter Authentication Code"
                    value={ldrAuthCode}
                    onChange={(e) => setLdrAuthCode(e.target.value)}
                    className="w-full bg-white border border-blue-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-blue-950 font-bold tracking-widest placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Enter your official group authorization code to register as an active leader.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLeader}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-sm shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                <span>{isSubmittingLeader ? 'Registering…' : 'Submit Official Leader Registration'}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: CHURCH ADMIN SIGN UP */}
        {activeTab === 'admin_signup' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-700 text-white font-black">
                  <span className="material-symbols-outlined text-[24px]">church</span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Pastor Church Registration</h3>
                  <p className="text-xs text-slate-500">
                    The church pastor creates the church account. After signing in you can appoint church administrators and ushers.
                  </p>
                </div>
              </div>

            </div>

            {admSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                <span>{admSuccessMsg}</span>
              </div>
            )}

            {admError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-rose-600">error</span>
                <span>{admError}</span>
              </div>
            )}

            <form onSubmit={handleAdminSignUp} className="space-y-4">
              <h4 className="portal-form-section">Pastor details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    1. Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Pastor's full name"
                    value={admFullName}
                    onChange={(e) => setAdmFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    2. Email (Required) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="email@cekorlebu.org"
                    value={admRequiredEmail}
                    onChange={(e) => setAdmRequiredEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    3. Church Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. your church branch name"
                    value={admChurchName}
                    onChange={(e) => setAdmChurchName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    5. Admin Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+233 24 555 0000"
                    value={admPhone}
                    onChange={(e) => setAdmPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    6. Password *
                  </label>
                  <PasswordInput
                    
                    required
                    placeholder="••••••••"
                    value={admPassword}
                    onChange={(e) => setAdmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    Profile Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {admPhotoPreview ? (
                      <img src={admPhotoPreview} alt="Selected profile photo" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[22px]">person</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAdmPhotoFile(file);
                        setAdmPhotoPreview(file ? URL.createObjectURL(file) : '');
                      }}
                      className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-800 file:text-xs file:font-bold cursor-pointer"
                    />
                  </div>
                </div>

              </div>

              {/* 7. AUTHENTICATION CODE - CLEAN EMPTY PLACEHOLDER */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <label className="block text-xs font-black text-blue-800 ">
                  7. Authentication Code Required *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-[18px]">
                    shield_lock
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter Authentication Code"
                    value={admAuthCode}
                    onChange={(e) => setAdmAuthCode(e.target.value)}
                    className="w-full bg-white border border-blue-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-blue-950 font-bold tracking-widest placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Required security code to provision a church admin account on the platform.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAdmin}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-sm shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">add_business</span>
                <span>{isSubmittingAdmin ? 'Creating account…' : 'Register Church Account & Create Admin Account'}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: ADMIN LOGIN PAGE */}
        {activeTab === 'login' && (
          <div className="portal-centered-card max-w-md mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-sm">
           <div className="portal-centered-content">
            <div className="space-y-6">
            <div className="portal-login-heading text-center space-y-1">
              <ChurchLogo className="w-14 h-14 mx-auto mb-4" />
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">CE Korle Bu Sign In</p>
              <h3 className="font-display font-extrabold text-xl text-slate-900">Sign in to your account</h3>
              <p className="text-xs text-slate-500">Group pastors, church admins and ushers all sign in here.</p>
            </div>

            {/* Real Authentication Error Banner */}
            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium flex items-start gap-2.5 animate-fadeIn">
                <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex-1">
                  <p className="font-bold text-xs text-rose-900">{unverifiedEmail ? 'Email not confirmed yet' : 'Authentication Failed'}</p>
                  <p className="mt-0.5 text-xs leading-relaxed">{loginError}</p>
                  {unverifiedEmail && (
                    <>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isResendingVerify}
                        className="mt-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-xs px-3 py-2 rounded-xl"
                      >
                        {isResendingVerify ? 'Sending…' : 'Resend confirmation link'}
                      </button>
                      {verifyFeedback && <p className="mt-1.5 text-xs text-slate-700">{verifyFeedback}</p>}
                    </>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Email / Username *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="you@cekorlebu.org"
                    value={loginIdentifier}
                    onChange={(e) => {
                      setLoginIdentifier(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(loginIdentifier && loginIdentifier.includes('@') ? loginIdentifier : '');
                      setResetFeedback(null);
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">lock_reset</span>
                    <span>Forgot Password?</span>
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    lock
                  </span>
                  <PasswordInput
                    
                    required
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="Enter account password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                  />
                </div>
              </div>

              {otpStep && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-blue-900">{otpInfo}</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    aria-label="Sign-in code"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-lg font-bold tracking-[0.4em] text-center outline-none focus:border-blue-600"
                  />
                  <button type="button" onClick={() => { setOtpCode(''); setOtpStep(false); }} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">Send a new code</button>
                </div>
              )}



              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full font-bold text-xs py-3.5 rounded-xl transition-all shadow-sm bg-blue-700 hover:bg-blue-800 text-white shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 active:scale-[0.99]"
              >
                {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Signing in…</span>
                  </span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
            </div>
           </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
        <span>Christ Embassy Korle Bu • All Rights Reserved © 2026</span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span>
          Developed by{' '}
          <a
            href="https://primehaven.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:text-blue-800 underline font-semibold transition-colors"
          >
            Prime Haven
          </a>
        </span>
      </footer>

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full border border-slate-200 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[20px]">lock_reset</span>
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-slate-900">Password Recovery</h3>
                <p className="text-xs text-slate-500">Secure Password Reset</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Enter your registered administrator or pastor email address. A secure one-time password reset link will be dispatched to your inbox.
            </p>

            {resetFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs mb-4 flex items-start gap-2.5 ${
                  resetFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                  {resetFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <div className="text-xs leading-relaxed font-medium">
                  {resetFeedback.message}
                </div>
              </div>
            )}

            {resetLink && (
              <a
                href={resetLink}
                className="block mb-4 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100"
              >
                Tap here to create your new password
              </a>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Administrator Email *
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="e.g. admin@cekorlebu.org"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetFeedback(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-700/20 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isResetting && <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>}
                  <span>{isResetting ? 'Dispatching...' : 'Send Reset Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
