import { getSupabase } from './supabase';
import { getPortalToken } from './portalDb';
import {
  Member,
  Leader,
  AttendanceRecord,
  ChurchBranch,
  ChurchAdminAccount,
  AuditLogItem,
  PromotionQueueItem,
  AuthSessionUser
} from '../types';

export const SESSION_STORAGE_KEY = 'gcyc_auth_session';

export function saveStoredSession(user: AuthSessionUser): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to save session to localStorage:', err);
  }
}

export function getStoredSession(): AuthSessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.role && (parsed.name || parsed.email)) {
      return {
        id: parsed.id || `usr-${Date.now()}`,
        name: parsed.name || (parsed.role === 'Superadmin' ? 'Group Pastor' : 'Church Admin'),
        role: parsed.role,
        church: parsed.church !== undefined && parsed.church !== null ? parsed.church : (parsed.role === 'Superadmin' ? 'GCYC Group HQ' : ''),
        zone: parsed.zone || 'Zone 1 (Korle Bu)',
        avatar: parsed.avatar || (parsed.role === 'Superadmin'
          ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'),
        email: parsed.email || '',
        phone: parsed.phone || '+233 24 123 4567'
      };
    }
  } catch (err) {
    console.warn('Failed to parse session from localStorage:', err);
  }
  return null;
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear session from localStorage:', err);
  }
}

export async function signOutFromSupabase(): Promise<void> {
  clearStoredSession();
  const client = getSupabase();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) { }
  }
}

/**
 * Service wrapper to interact directly with Supabase PostgreSQL tables.
 * Performs async fetch, upsert, and deletion with safe fallbacks and detailed error logging.
 */

// ============================================================================
// 1. MEMBERS CRUD
// ============================================================================

export async function fetchMembersFromSupabase(): Promise<Member[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('members').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchMembers error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone || '',
      email: row.email || '',
      dob: row.dob || '',
      role: (row.role === 'Leader' || row.role === 'First Timer') ? row.role : 'Member',
      occupation: row.occupation || 'General',
      education: row.education_level || 'Tertiary',
      location: row.location || 'Korle Bu',
      church: row.church_name || 'Unassigned',
      joinDate: row.join_date || row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      initials: (row.full_name || 'MB').split(' ').filter(Boolean).map((n: string) => n ? n[0] : '').join('').toUpperCase().slice(0, 2) || 'MB',
      serviceCount: row.service_count || 1,
      foundationClass: row.foundation_class || 0,
      status: row.status || 'First Timer',
      invitedBy: row.invited_by_name || 'Self Check-In',
      invitedByLeaderId: row.invited_by_leader_id || undefined,
      gender: row.gender || 'Male',
      maritalStatus: row.marital_status || undefined,
      photoUrl: row.photo_url || undefined

    }));
  } catch (err) {
    console.error('Error in fetchMembersFromSupabase:', err);
    return null;
  }
}

// Resolves a church branch name to its database id so records route to the right branch.
const churchIdCache = new Map<string, string | null>();
export async function resolveChurchId(churchName?: string): Promise<string | null> {
  const name = (churchName || '').trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (churchIdCache.has(key)) return churchIdCache.get(key) || null;
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data } = await client.from('churches').select('id').ilike('name', name).maybeSingle();
    const id = (data as any)?.id || null;
    churchIdCache.set(key, id);
    return id;
  } catch {
    return null;
  }
}

export async function saveMemberToSupabase(member: Member): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const payload = {
      id: member.id,
      full_name: member.fullName,
      email: member.email || null,
      phone: member.phone,
      dob: member.dob || null,
      role: member.role,
      occupation: member.occupation,
      education_level: member.education,
      location: member.location,
      church_id: await resolveChurchId(member.church),
      church_name: member.church,
      invited_by_name: member.invitedBy,
      invited_by_leader_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((member as any).invitedByLeaderId || '')
        ? (member as any).invitedByLeaderId
        : null,
      service_count: member.serviceCount,
      foundation_class: member.foundationClass,
      status: member.status,
      gender: member.gender || null,
      marital_status: member.maritalStatus || null,
      photo_url: member.photoUrl || null,
      join_date: member.joinDate
    };

    const { error } = await client.from('members').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase saveMember error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveMemberToSupabase:', err);
    return false;
  }
}

export async function deleteMemberFromSupabase(memberId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('members').delete().eq('id', memberId);
    if (error) {
      console.warn('Supabase deleteMember error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in deleteMemberFromSupabase:', err);
    return false;
  }
}

// ============================================================================
// 2. LEADERS CRUD
// ============================================================================

export async function fetchLeadersFromSupabase(): Promise<Leader[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('leaders').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchLeaders error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      contact: row.contact,
      dob: row.dob || '',
      location: row.location || '',
      leaderType: row.leader_type,
      cellOrPcfName: row.cell_or_pcf_name,
      parentLeaderId: row.parent_leader_id,
      parentLeaderName: row.parent_leader_name,
      isAppointed: row.is_appointed || false,
      downstreamCount: row.downstream_count || 0,
      leaderCode: row.leader_code || undefined,
      church: row.church_name || 'Unassigned',
      promotionStatus: row.promotion_status || 'None',
      photoUrl: row.photo_url || undefined,
      joinedDate: row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      initials: (row.full_name || 'LD').split(' ').filter(Boolean).map((n: string) => n ? n[0] : '').join('').toUpperCase().slice(0, 2) || 'LD'
    }));
  } catch (err) {
    console.error('Error in fetchLeadersFromSupabase:', err);
    return null;
  }
}

export async function saveLeaderToSupabase(leader: Leader): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leader.id || '');

    // Route the leader to the church branch they belong to
    const churchId = await resolveChurchId(leader.church);

    const payload: any = {
      full_name: leader.fullName,
      email: leader.email,
      contact: leader.contact,
      dob: leader.dob || null,
      location: leader.location || null,
      leader_type: leader.leaderType,
      cell_or_pcf_name: leader.cellOrPcfName,
      parent_leader_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leader.parentLeaderId || '')
        ? leader.parentLeaderId
        : null,
      is_appointed: leader.isAppointed || false,
      downstream_count: leader.downstreamCount || 0,
      church_id: churchId,
      church_name: leader.church,
      promotion_status: leader.promotionStatus || 'None',
      photo_url: leader.photoUrl || null,
      leader_code: leader.leaderCode || generateLeaderCode()
    };
    if (isUuid) payload.id = leader.id;

    const { data, error } = isUuid
      ? await client.from('leaders').upsert(payload, { onConflict: 'id' }).select('id, leader_code').maybeSingle()
      : await client.from('leaders').insert(payload).select('id, leader_code').maybeSingle();

    if (error) {
      console.warn('Supabase saveLeader error:', error.message);
      return false;
    }

    // Keep the in-app record aligned with the database identifier
    const newId = (data as any)?.id;
    if (newId && newId !== leader.id) {
      leader.id = newId;
    }
    leader.leaderCode = (data as any)?.leader_code || payload.leader_code;
    return true;
  } catch (err) {
    console.error('Error in saveLeaderToSupabase:', err);
    return false;
  }
}

/** Short scan code printed on a leader's pass, e.g. LDR-4821. */
export function generateLeaderCode(): string {
  return `LDR-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Every leader is also a member. This keeps the member database in step:
 * an existing member record is tagged as a leader, otherwise a new member row
 * is created using the leader's scan code as its ID. Returns the member ID.
 */
export async function syncLeaderAsMember(leader: Leader): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const email = (leader.email || '').trim();
    let existingId: string | null = null;

    if (email) {
      const { data } = await client.from('members').select('id').ilike('email', email).maybeSingle();
      existingId = (data as any)?.id || null;
    }
    if (!existingId && leader.fullName) {
      const { data } = await client
        .from('members')
        .select('id, church_name')
        .ilike('full_name', leader.fullName.trim())
        .limit(5);
      const match = (data || []).find(
        (row: any) => (row.church_name || '').toLowerCase() === (leader.church || '').toLowerCase()
      ) || (data || [])[0];
      existingId = (match as any)?.id || null;
    }

    const memberId = existingId || leader.leaderCode || generateLeaderCode();
    const churchId = await resolveChurchId(leader.church);

    const payload: any = {
      id: memberId,
      full_name: leader.fullName,
      email: leader.email || null,
      phone: leader.contact || null,
      dob: leader.dob || null,
      role: 'Leader',
      location: leader.location || null,
      church_id: churchId,
      church_name: leader.church,
      photo_url: leader.photoUrl || null,
      status: 'General Member',
      // Registering as a leader means foundation school is complete.
      foundation_class: 7
    };
    if (!existingId) {
      payload.occupation = 'General';
      payload.education_level = 'Tertiary';
      payload.service_count = 1;
      payload.join_date = leader.joinedDate || new Date().toISOString().slice(0, 10);
      payload.invited_by_name = leader.parentLeaderName || 'Leader Registration';
    }

    const { error } = await client.from('members').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase syncLeaderAsMember error:', error.message);
      return null;
    }
    return memberId;
  } catch (err) {
    console.error('Error in syncLeaderAsMember:', err);
    return null;
  }
}



export async function deleteLeaderFromSupabase(leaderId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('leaders').delete().eq('id', leaderId);
    if (error) {
      console.warn('Supabase deleteLeader error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in deleteLeaderFromSupabase:', err);
    return false;
  }
}

// ============================================================================
// 3. ATTENDANCE RECORDS CRUD
// ============================================================================

export async function fetchAttendanceFromSupabase(): Promise<AttendanceRecord[] | null> {
  const client = getSupabase();
  if (!client) return null;
  if (!getPortalToken()) return []; // history is only for signed-in accounts


  try {
    const { data, error } = await client.from('attendance_records').select('*').order('checked_in_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchAttendance error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      memberRole: row.member_role || 'Member',
      serviceType: row.service_type,
      timestamp: row.checked_in_time || '08:30 AM',
      date: row.attendance_date || row.checked_in_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      verifiedBy: row.verified_by,
      status: row.status || 'Confirmed',
      church: row.church_name,
      checkInMethod: row.check_in_method || 'QR Scan',
      leaderName: row.leader_name || 'Direct / Self',
      pcfName: row.pcf_name || 'General PCF'
    }));
  } catch (err) {
    console.error('Error in fetchAttendanceFromSupabase:', err);
    return null;
  }
}

export async function saveAttendanceToSupabase(record: AttendanceRecord): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const payload = {
      id: record.id,
      member_id: record.memberId,
      member_name: record.memberName,
      member_role: record.memberRole,
      service_type: record.serviceType,
      church_id: await resolveChurchId(record.church),
      church_name: record.church,
      check_in_method: record.checkInMethod,
      verified_by: record.verifiedBy,
      status: record.status,
      checked_in_time: record.timestamp,
      leader_name: record.leaderName || 'Direct / Self',
      pcf_name: record.pcfName || 'General PCF',
      attendance_date: record.date || new Date().toISOString().slice(0, 10),
      checked_in_at: new Date().toISOString()
    };

    // A brand-new member's own record may still be saving when the check-in
    // arrives, so retry briefly instead of silently dropping the attendance.
    let error: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      ({ error } = await client.from('attendance_records').upsert(payload, { onConflict: 'id' }));
      if (!error) break;
      const msg = String(error.message || '').toLowerCase();
      if (!msg.includes('foreign key') && !msg.includes('violates')) break;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
    if (error) {
      console.warn('Supabase saveAttendance error:', error.message);
      const msg = String(error.message || '').toLowerCase();
      if (!navigator.onLine || msg.includes('fetch') || msg.includes('network')) queueOfflineAttendance(record);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveAttendanceToSupabase:', err);
    queueOfflineAttendance(record);
    return false;
  }
}

// ---- Offline check-ins: kept on the device and sent once the connection returns.
const OFFLINE_KEY = 'cekb_offline_attendance';

export function getOfflineAttendance(): AttendanceRecord[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; }
}

function queueOfflineAttendance(record: AttendanceRecord) {
  const list = getOfflineAttendance().filter(r => r.id !== record.id);
  list.push(record);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('cekb-offline-change'));
}

let flushing = false;
export async function flushOfflineAttendance(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  const pending = getOfflineAttendance();
  if (!pending.length) return 0;
  flushing = true;
  localStorage.setItem(OFFLINE_KEY, '[]');
  let sent = 0;
  try {
    for (const r of pending) if (await saveAttendanceToSupabase(r)) sent++; // failures re-queue themselves
  } finally {
    flushing = false;
    window.dispatchEvent(new Event('cekb-offline-change'));
  }
  return sent;
}

export async function deleteAttendanceFromSupabase(recordId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('attendance_records').delete().eq('id', recordId);
    if (error) {
      console.warn('Supabase deleteAttendance error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in deleteAttendanceFromSupabase:', err);
    return false;
  }
}

export async function deleteChurchAdminFromSupabase(adminEmail: string): Promise<boolean> {
  const email = (adminEmail || '').trim().toLowerCase();
  if (!email) return false;

  try {
    const stored: any[] = JSON.parse(localStorage.getItem('cekbu_church_admins') || '[]');
    localStorage.setItem(
      'cekbu_church_admins',
      JSON.stringify(stored.filter(a => a && (a.adminEmail || '').toLowerCase().trim() !== email))
    );
  } catch (e) { }

  const client = getSupabase();
  if (!client) return true;

  try {
    const { error: adminErr } = await client.from('church_admin_accounts').delete().ilike('admin_email', email);
    if (adminErr) console.warn('Supabase deleteChurchAdmin error:', adminErr.message);

    const { error: profileErr } = await client
      .from('user_profiles')
      .delete()
      .ilike('email', email)
      .neq('role', 'Superadmin');
    if (profileErr) console.warn('Supabase deleteChurchAdmin profile error:', profileErr.message);

    return !adminErr;
  } catch (err) {
    console.error('Error in deleteChurchAdminFromSupabase:', err);
    return false;
  }
}


export async function clearTodayAttendanceFromSupabase(todayDate: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const startOfDay = new Date(`${todayDate}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${todayDate}T23:59:59.999Z`).toISOString();

    const { error } = await client
      .from('attendance_records')
      .delete()
      .gte('checked_in_at', startOfDay)
      .lte('checked_in_at', endOfDay);

    if (error) {
      console.warn('Supabase clearTodayAttendance error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in clearTodayAttendanceFromSupabase:', err);
    return false;
  }
}

// ============================================================================
// 4. CHURCHES & BRANCHES CRUD
// ============================================================================

export async function fetchChurchesFromSupabase(): Promise<ChurchBranch[] | null> {
  // Purge legacy cache keys from localStorage
  try {
    localStorage.removeItem('cekbu_churches');
  } catch (e) { }

  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client.from('churches').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetchChurches error:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      pastor: row.pastor_name || 'Pastor in Charge',
      membersCount: row.members_count || 0,
      status: (row.status as any) || 'Healthy',
      zone: row.zone || 'Zone 1 (Korle Bu)',
      pcfCount: row.pcf_count || 0,
      cellCount: row.cell_count || 0,
      bsctCount: row.bsct_count || 0
    }));
  } catch (err) {
    console.error('Error in fetchChurchesFromSupabase:', err);
    return [];
  }
}

export async function saveChurchToSupabase(church: ChurchBranch): Promise<boolean> {
  // 1. Immediately cache in localStorage
  try {
    const stored: ChurchBranch[] = JSON.parse(localStorage.getItem('cekbu_churches') || '[]');
    const churchNameLower = (church.name || '').toLowerCase();
    const filtered = stored.filter(c => c && (c.name || '').toLowerCase() !== churchNameLower);
    localStorage.setItem('cekbu_churches', JSON.stringify([...filtered, church]));
  } catch (e) { }

  const client = getSupabase();
  if (!client) return true;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(church.id);
    const payload: any = {
      name: church.name,
      pastor_name: church.pastor,
      members_count: church.membersCount || 0,
      status: church.status || 'Growing',
      zone: church.zone || 'Zone 1 (Korle Bu)'
    };
    if (isUuid) {
      payload.id = church.id;
    }

    const { error } = await client.from('churches').upsert(payload, { onConflict: 'name' });
    if (error) {
      console.warn('Supabase saveChurch error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveChurchToSupabase:', err);
    return false;
  }
}

export async function deleteChurchFromSupabase(churchId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('churches').delete().eq('id', churchId);
    if (error) {
      console.warn('Supabase deleteChurch error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in deleteChurchFromSupabase:', err);
    return false;
  }
}

// ============================================================================
// 5. CHURCH ADMIN ACCOUNTS CRUD & PERSISTENCE
// ============================================================================

export async function fetchChurchAdminsFromSupabase(): Promise<ChurchAdminAccount[] | null> {
  // Purge legacy cache keys from localStorage
  try {
    localStorage.removeItem('cekbu_church_admins');
  } catch (e) { }

  const client = getSupabase();
  if (!client) return [];

  try {
    const adminMap = new Map<string, ChurchAdminAccount>();

    // 1. Fetch from church_admin_accounts table
    const { data: adminData, error: adminErr } = await client
      .from('church_admin_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!adminErr && adminData) {
      adminData.forEach((row: any) => {
        const email = (row.admin_email || '').toLowerCase().trim();
        if (email) {
          adminMap.set(email, {
            id: row.id || `ADM-${Date.now()}`,
            adminName: row.admin_name || 'Admin',
            adminEmail: row.admin_email,
            adminPhone: row.admin_phone || '+233 24 000 0000',
            churchName: row.church_name || '',
            zone: row.zone || 'Zone 1 (Korle Bu)',
            joinedDate: row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            status: 'Active',
            photoUrl: row.photo_url || undefined
          });
        }
      });
    }

    // 2. Fetch from user_profiles table
    const { data: userData, error: userErr } = await client
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!userErr && userData) {
      userData.forEach((row: any) => {
        const email = (row.email || '').toLowerCase().trim();
        if (email && (row.role === 'Church Admin' || row.role === 'Superadmin')) {
          const existing = adminMap.get(email);
          adminMap.set(email, {
            id: row.id || existing?.id || `ADM-${Date.now()}`,
            adminName: row.full_name || row.username || existing?.adminName || 'Admin',
            adminEmail: row.email,
            adminPhone: existing?.adminPhone || '+233 24 000 0000',
            churchName: row.role === 'Superadmin' ? '' : (row.church_name || existing?.churchName || ''),
            zone: row.zone || existing?.zone || 'Zone 1 (Korle Bu)',
            joinedDate: row.created_at?.slice(0, 10) || existing?.joinedDate || new Date().toISOString().slice(0, 10),
            status: 'Active',
            photoUrl: row.avatar_url || existing?.photoUrl
          });
        }
      });
    }

    return Array.from(adminMap.values());
  } catch (err) {
    console.error('Error in fetchChurchAdminsFromSupabase:', err);
    return [];
  }
}

export async function saveChurchAdminToSupabase(admin: ChurchAdminAccount): Promise<boolean> {
  const email = (admin.adminEmail || '').trim().toLowerCase();
  const passwordToStore = admin.password?.trim() || '';
  // Passwords are never cached on the device; the server scrambles them on save.

  // 1. Immediately cache in localStorage for instant persistence
  try {
    const stored: ChurchAdminAccount[] = JSON.parse(localStorage.getItem('cekbu_church_admins') || '[]');
    const filtered = stored.filter(a => a && (a.adminEmail || '').toLowerCase().trim() !== email);
    const enrichedAdmin: ChurchAdminAccount = {
      ...admin,
      adminEmail: email,
      password: undefined
    };
    localStorage.setItem('cekbu_church_admins', JSON.stringify([enrichedAdmin, ...filtered]));
  } catch (e) {
    console.warn('localStorage save admin error:', e);
  }

  const client = getSupabase();
  if (!client) return true;

  try {
    const rawUsername = email.split('@')[0] || `admin_${Date.now().toString().slice(-4)}`;

    // 2. Fetch church ID if present
    let churchId: string | null = null;
    try {
      const { data: churchRows } = await client
        .from('churches')
        .select('id')
        .ilike('name', admin.churchName.trim())
        .limit(1);

      if (churchRows && churchRows.length > 0) {
        churchId = churchRows[0].id;
      }
    } catch (cErr) { }

    // 3. Upsert into user_profiles
    const userPayload: any = {
      username: rawUsername,
      email: email,
      full_name: admin.adminName,
      role: 'Church Admin',
      church_name: admin.churchName,
      zone: admin.zone || 'Zone 1 (Korle Bu)',
      avatar_url: admin.photoUrl || null
    };
    if (churchId) {
      userPayload.church_id = churchId;
    }
    // Only set the password when one was actually provided — otherwise an
    // existing account's password would be wiped out by the upsert.
    if (passwordToStore) {
      userPayload.password_hash = passwordToStore;
    }

    const { error: userErr } = await client.from('user_profiles').upsert(userPayload, { onConflict: 'email' });
    if (userErr) {
      console.warn('Supabase saveChurchAdmin user_profiles warning:', userErr.message);
      // If username collided with existing, use timestamp suffix
      if (userErr.message?.includes('username') || userErr.message?.includes('23505')) {
        userPayload.username = `${rawUsername}_${Date.now().toString().slice(-4)}`;
        await client.from('user_profiles').upsert(userPayload, { onConflict: 'email' });
      }
    }

    // 4. Upsert into church_admin_accounts table (check existing by email first to avoid duplicate primary key errors)
    let adminIdToUse = admin.id || `ADM-${Date.now().toString().slice(-4)}`;
    try {
      const { data: existingAdminRow } = await client
        .from('church_admin_accounts')
        .select('id')
        .eq('admin_email', email)
        .maybeSingle();
      if (existingAdminRow?.id) {
        adminIdToUse = existingAdminRow.id;
      }
    } catch (e) { }

    const adminPayload: any = {
      id: adminIdToUse,
      church_name: admin.churchName,
      admin_name: admin.adminName,
      admin_email: email,
      admin_phone: admin.adminPhone || '+233 24 000 0000',
      zone: admin.zone || 'Zone 1 (Korle Bu)',
      role: 'Church Admin',
      photo_url: admin.photoUrl || null
    };
    if (passwordToStore) {
      adminPayload.password = passwordToStore;
    }

    const { error: adminErr } = await client.from('church_admin_accounts').upsert(adminPayload, { onConflict: 'id' });
    if (adminErr) {
      console.warn('Supabase saveChurchAdmin church_admin_accounts warning:', adminErr.message);
    }

    return true;
  } catch (err) {
    console.error('Error in saveChurchAdminToSupabase:', err);
    return false;
  }
}

// ============================================================================
// 5a. AUDIT LOG LOGGER ENGINE (DEDUPLICATED & CAPPED AT 10)
// ============================================================================

// Memory cache to prevent duplicate rapid inserts within 3 seconds
const recentAuditLogSignatures = new Set<string>();

export async function saveAuditLogToSupabase(log: {
  id?: string;
  action: string;
  timestamp?: string;
  icon?: string;
  user?: string;
  church?: string;
  category?: string;
}): Promise<boolean> {
  const actor = log.user || 'System';
  const action = (log.action || '').trim();
  const signature = `${actor}__${action}__${log.church || ''}`;

  // Prevent duplicate log within 3 seconds
  if (recentAuditLogSignatures.has(signature)) {
    return true;
  }
  recentAuditLogSignatures.add(signature);
  setTimeout(() => {
    recentAuditLogSignatures.delete(signature);
  }, 4000);

  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('audit_logs').insert({
      actor: actor,
      action: action,
      category: log.category || 'System',
      icon: log.icon || 'info',
      church_name: log.church || null
    });
    if (error) {
      console.warn('Supabase saveAuditLog error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveAuditLogToSupabase:', err);
    return false;
  }
}

// ============================================================================
// 5b. REAL DATABASE AUTHENTICATION & VALIDATION ENGINE
// ============================================================================

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
    zone: string;
    email: string;
  };
  error?: string;
}

export async function authenticateUserWithDatabase(
  identifier: string,
  passwordPlain: string,
  selectedRole?: 'Superadmin' | 'Church Admin',
  localFallbackAdmins?: ChurchAdminAccount[],
  localFallbackChurches?: ChurchBranch[]
): Promise<AuthResult> {
  const trimmedId = identifier.trim();
  const trimmedPassword = passwordPlain.trim();

  if (!trimmedId) {
    return { success: false, error: 'Please enter your administrator Email or Username.' };
  }
  if (!trimmedPassword) {
    return { success: false, error: 'Please enter your password.' };
  }

  const client = getSupabase();

  // 1. Try real-time database validation via Supabase
  if (client) {
    try {
      // Option A: Try stored RPC procedure if created in database
      const { data: rpcData, error: rpcError } = await client.rpc('verify_user_login', {
        p_identifier: trimmedId,
        p_password: trimmedPassword,
        p_role: selectedRole || null,
        p_church_name: null
      });

      if (!rpcError && rpcData) {
        if (rpcData.success && rpcData.user) {
          const authenticatedUser: AuthSessionUser = {
            id: rpcData.user.id || `usr-${Date.now()}`,
            name: rpcData.user.name || (rpcData.user.role === 'Superadmin' ? 'Group Pastor' : 'Church Admin'),
            role: rpcData.user.role as 'Superadmin' | 'Church Admin',
            church: rpcData.user.church || (rpcData.user.role === 'Superadmin' ? 'GCYC Group HQ' : ''),
            zone: rpcData.user.zone || 'Zone 1 (Korle Bu)',
            avatar: rpcData.user.role === 'Superadmin'
              ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
              : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
            email: rpcData.user.email || trimmedId,
            phone: rpcData.user.phone || '+233 24 123 4567'
          };
          saveStoredSession(authenticatedUser);
          return { success: true, user: authenticatedUser };
        } else if (rpcData.error) {
          return { success: false, error: rpcData.error };
        }
      }

      if (rpcError) {
        console.warn('Sign-in check failed:', rpcError.message);
      }
    } catch (dbErr: any) {
      console.warn('Sign-in check error:', dbErr?.message);
      return { success: false, error: 'We could not reach the sign-in service. Please try again.' };
    }
  }

  // Passwords are stored scrambled and only checked on the server, so there is
  // no offline fallback: a wrong email or password always ends here.
  return {
    success: false,
    error: 'Incorrect email or password. Please check your details and try again.'
  };
}


// ============================================================================
// 6. PROMOTION QUEUE CRUD
// ============================================================================

export async function fetchPromotionQueueFromSupabase(): Promise<PromotionQueueItem[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('promotion_queue').select('*').order('flagged_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchPromotionQueue error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return [];

    return data
      .filter((row: any) => (row.status || 'Pending') === 'Pending')
      .map((row: any) => ({
        id: row.id,
        leaderId: row.leader_id,
        leaderName: row.member_name || row.leader_name || 'Leader',
        memberId: row.member_id || undefined,
        church: row.church_name || 'Unassigned',
        currentRole: row.current_leader_role,
        targetRole: row.target_role,
        downstreamCount: row.downstream_count || 0,
        flaggedAt: (row.flagged_at || new Date().toISOString()).slice(0, 10),
        reason: row.reason,
        requestedBy: row.requested_by || undefined,
        status: row.status || 'Pending'
      }));
  } catch (err) {
    console.error('Error in fetchPromotionQueueFromSupabase:', err);
    return null;
  }
}

/**
 * A branch admin proposes that a member (or existing leader) takes on a leader
 * role. Nothing changes until the group account approves it.
 */
export async function requestPromotionInSupabase(request: {
  memberId?: string;
  memberName: string;
  leaderId?: string;
  church: string;
  currentRole: string;
  targetRole: string;
  reason: string;
  requestedBy: string;
}): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const churchId = await resolveChurchId(request.church);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.leaderId || '');
    const { error } = await client.from('promotion_queue').insert({
      leader_id: isUuid ? request.leaderId : null,
      member_id: request.memberId || null,
      member_name: request.memberName,
      church_id: churchId,
      church_name: request.church,
      current_leader_role: request.currentRole,
      target_role: request.targetRole,
      reason: request.reason,
      requested_by: request.requestedBy,
      status: 'Pending'
    });
    if (error) {
      console.warn('Supabase requestPromotion error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in requestPromotionInSupabase:', err);
    return false;
  }
}

export async function confirmPromotionInSupabase(promotionId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('promotion_queue').delete().eq('id', promotionId);
    if (error) {
      console.warn('Supabase confirmPromotion error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in confirmPromotionInSupabase:', err);
    return false;
  }
}

/** The group account turns down a promotion request. */
export async function declinePromotionInSupabase(promotionId: string): Promise<boolean> {
  return confirmPromotionInSupabase(promotionId);
}

// ============================================================================
// 7. SYSTEM AUDIT LOGS CRUD (CAPPED AT 10 & DEDUPLICATED)
// ============================================================================

export async function fetchAuditLogsFromSupabase(limit = 10): Promise<AuditLogItem[] | null> {
  const client = getSupabase();
  if (!client) return null;
  if (!getPortalToken()) return []; // activity history is only for signed-in accounts


  try {
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.max(limit, 20)); // fetch slightly more to allow accurate deduplication

    if (error) {
      console.warn('Supabase fetchAuditLogs error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return [];

    // Deduplicate logs based on actor + action signature
    const seenSignatures = new Set<string>();
    const deduplicated: AuditLogItem[] = [];

    for (const row of data) {
      const sig = `${(row.actor || '').toLowerCase().trim()}__${(row.action || '').toLowerCase().trim()}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        deduplicated.push({
          id: `log-${row.id}`,
          action: row.action,
          timestamp: row.created_at?.slice(0, 19).replace('T', ' ') + ' UTC',
          icon: row.icon || 'info',
          user: row.actor || 'System',
          church: row.church_name || 'Group HQ',
          category: row.category || 'System'
        });
      }
      if (deduplicated.length >= 10) break; // Strict cap of 10 items
    }

    return deduplicated;
  } catch (err) {
    console.error('Error in fetchAuditLogsFromSupabase:', err);
    return null;
  }
}

// ============================================================================
// 7b. GLOBAL SERVICE PROGRAMS CRUD (PERSISTED TO SUPABASE)
// ============================================================================

export async function fetchServiceTypesFromSupabase(): Promise<string[]> {
  const defaultServices = ['Sunday Service', 'Midweek Service', 'Special Service'];
  
  try {
    const cached = localStorage.getItem('cekbu_global_services');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  const client = getSupabase();
  if (!client) return defaultServices;

  try {
    const { data, error } = await client
      .from('service_types')
      .select('name')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      localStorage.setItem('cekbu_global_services', JSON.stringify(defaultServices));
      return defaultServices;
    }

    const serviceNames = data.map((r: any) => r.name);
    localStorage.setItem('cekbu_global_services', JSON.stringify(serviceNames));
    return serviceNames;
  } catch (err) {
    console.warn('Error in fetchServiceTypesFromSupabase:', err);
    return defaultServices;
  }
}

export async function saveServiceTypeToSupabase(name: string, description?: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;

  try {
    const cached: string[] = JSON.parse(localStorage.getItem('cekbu_global_services') || '["Sunday Service", "Midweek Service", "Special Service"]');
    if (!cached.includes(trimmed)) {
      localStorage.setItem('cekbu_global_services', JSON.stringify([...cached, trimmed]));
    }
  } catch (e) {}

  const client = getSupabase();
  if (!client) return true;

  try {
    const { error } = await client.from('service_types').upsert({
      name: trimmed,
      description: description || 'Global Church Service Program',
      is_active: true
    }, { onConflict: 'name' });

    if (error) {
      console.warn('Supabase saveServiceType error:', error.message);
    }

    await saveAuditLogToSupabase({
      action: `Created new global service program: "${trimmed}"`,
      icon: 'tune',
      user: 'Group Pastor',
      category: 'System'
    });

    return true;
  } catch (err) {
    console.error('Error in saveServiceTypeToSupabase:', err);
    return false;
  }
}

export async function deleteServiceTypeFromSupabase(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;

  try {
    const cached: string[] = JSON.parse(localStorage.getItem('cekbu_global_services') || '[]');
    localStorage.setItem('cekbu_global_services', JSON.stringify(cached.filter(s => s !== trimmed)));
  } catch (e) {}

  const client = getSupabase();
  if (!client) return true;

  try {
    await client.from('service_types').update({ is_active: false }).eq('name', trimmed);
    
    await saveAuditLogToSupabase({
      action: `Archived global service program: "${trimmed}"`,
      icon: 'delete',
      user: 'Group Pastor',
      category: 'System'
    });

    return true;
  } catch (err) {
    console.error('Error in deleteServiceTypeFromSupabase:', err);
    return false;
  }
}

// ============================================================================
// 7c. SUPERADMIN HQ & GROUP PROFILE & SETTINGS PERSISTENCE
// ============================================================================

export interface SuperadminProfile {
  name: string;
  email: string;
  phone?: string;
  churchName: string;
  zone?: string;
}

export async function fetchSuperadminProfileFromSupabase(): Promise<SuperadminProfile | null> {
  const client = getSupabase();

  if (client) {
    try {
      // 1. Try to fetch from admin_settings table with key 'hq_profile'
      const { data: settingData, error: settingErr } = await client
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'hq_profile')
        .maybeSingle();

      if (!settingErr && settingData?.setting_value) {
        const val = settingData.setting_value as any;
        const profile: SuperadminProfile = {
          name: val.pastor_name || val.name || 'Group Pastor',
          email: val.email || 'group.pastor@cekorlebu.org',
          phone: val.phone || '+233 24 123 4567',
          churchName: val.church_name || val.churchName || 'GCYC Group HQ',
          zone: val.zone || 'Zone 1 (Korle Bu)'
        };
        try {
          localStorage.setItem('cekbu_superadmin_profile', JSON.stringify(profile));
        } catch (e) {}
        return profile;
      }

      // 2. Try to fetch from user_profiles for Superadmin role
      const { data: userData, error: userErr } = await client
        .from('user_profiles')
        .select('*')
        .or('role.eq.Superadmin,username.eq.group.pastor')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!userErr && userData) {
        const profile: SuperadminProfile = {
          name: userData.full_name || 'Group Pastor',
          email: userData.email || 'group.pastor@cekorlebu.org',
          phone: (userData as any).phone || '+233 24 123 4567',
          churchName: userData.church_name || 'GCYC Group HQ',
          zone: userData.zone || 'Zone 1 (Korle Bu)'
        };
        try {
          localStorage.setItem('cekbu_superadmin_profile', JSON.stringify(profile));
        } catch (e) {}
        return profile;
      }
    } catch (err) {
      console.error('Error fetching Superadmin profile from Supabase:', err);
    }
  }

  // Fallback to local cache
  try {
    const cached = localStorage.getItem('cekbu_superadmin_profile');
    if (cached) return JSON.parse(cached);
    const session = getStoredSession();
    if (session && session.role === 'Superadmin') {
      return {
        name: session.name || 'Group Pastor',
        email: session.email || 'group.pastor@cekorlebu.org',
        phone: session.phone || '+233 24 123 4567',
        churchName: session.church || 'GCYC Group HQ',
        zone: session.zone || 'Zone 1 (Korle Bu)'
      };
    }
  } catch (e) {}

  return null;
}

export async function saveSuperadminProfileToSupabase(profile: {
  name: string;
  email: string;
  phone?: string;
  churchName: string;
  zone?: string;
}): Promise<boolean> {
  const email = (profile.email || '').trim().toLowerCase();
  const pastorName = (profile.name || '').trim();
  const phone = (profile.phone || '').trim() || '+233 24 123 4567';
  const churchName = (profile.churchName || '').trim() || 'GCYC Group HQ';
  const zone = (profile.zone || '').trim() || 'Zone 1 (Korle Bu)';

  // 1. Immediately persist to localStorage session & cache
  try {
    const currentSession = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}');
    const updatedSession = {
      ...currentSession,
      id: currentSession.id || 'usr-1',
      name: pastorName,
      email: email,
      role: 'Superadmin',
      church: churchName,
      zone: zone,
      phone: phone
    };
    saveStoredSession(updatedSession);
    localStorage.setItem('cekbu_superadmin_profile', JSON.stringify({
      name: pastorName,
      email: email,
      phone: phone,
      churchName: churchName,
      zone: zone
    }));
  } catch (e) {}

  const client = getSupabase();
  if (!client) return true;

  try {
    // 2. Persist to admin_settings table (key: 'hq_profile')
    const { error: hqErr } = await client.from('admin_settings').upsert({
      setting_key: 'hq_profile',
      admin_id: 'global',
      is_global: true,
      setting_value: {
        pastor_name: pastorName,
        name: pastorName,
        email: email,
        phone: phone,
        church_name: churchName,
        churchName: churchName,
        zone: zone,
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });

    if (hqErr) {
      console.warn('Supabase admin_settings hq_profile warning:', hqErr.message);
    }

    // 3. Persist to global_system_config in admin_settings
    try {
      const { data: currConfig } = await client
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'global_system_config')
        .maybeSingle();

      const existingVal = currConfig?.setting_value || {};
      await client.from('admin_settings').upsert({
        setting_key: 'global_system_config',
        admin_id: 'global',
        is_global: true,
        setting_value: {
          ...existingVal,
          pastorName: pastorName,
          hqEmail: email,
          pastorPhone: phone,
          hqChurchName: churchName,
          hqZone: zone,
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (cfgErr) {
      console.warn('Error syncing to global_system_config:', cfgErr);
    }

    // 4. Update user_profiles in Supabase
    const { error: userErr } = await client.from('user_profiles').upsert({
      username: 'group.pastor',
      email: email,
      full_name: pastorName,
      role: 'Superadmin',
      church_name: churchName,
      zone: zone,
      updated_at: new Date().toISOString()
    }, { onConflict: 'username' });

    if (userErr) {
      console.warn('Supabase saveSuperadmin user_profiles warning:', userErr.message);
    }

    // 5. Audit Log
    await saveAuditLogToSupabase({
      action: `Updated Superadmin HQ & Group Profile for ${pastorName} (${churchName})`,
      icon: 'admin_panel_settings',
      user: pastorName || 'Group Pastor',
      category: 'System',
      church: churchName
    });

    return true;
  } catch (err) {
    console.error('Error in saveSuperadminProfileToSupabase:', err);
    return false;
  }
}

export async function saveAllAdminSettingsToSupabase(settings: {
  securityCode?: string;
  hqEmail?: string;
  pastorName?: string;
  churchName?: string;
  hqChurchName?: string;
  zone?: string;
  hqZone?: string;
  pastorPhone?: string;
  globalServices?: string[];
  serviceTypes?: string[];
  autoPassDownload?: boolean;
  scannerSound?: boolean;
  autoPromoteFirstTimers?: boolean;
  promotionServicesCount?: number;
  autoBackupEnabled?: boolean;
}): Promise<boolean> {
  const client = getSupabase();
  if (!client) return true;

  try {
    const servicesToSave = settings.serviceTypes || settings.globalServices || [];
    await client.from('admin_settings').upsert({
      setting_key: 'global_system_config',
      setting_value: {
        ...settings,
        globalServices: servicesToSave,
        updated_at: new Date().toISOString()
      }
    }, { onConflict: 'setting_key' });

    if (servicesToSave.length > 0) {
      for (const srv of servicesToSave) {
        await saveServiceTypeToSupabase(srv);
      }
    }

    return true;
  } catch (err) {
    console.error('Error in saveAllAdminSettingsToSupabase:', err);
    return false;
  }
}

/**
 * Dispatches a password recovery email via Supabase Auth
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; message: string; link?: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Cannot reach the system right now. Please try again shortly.' };
  }
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, message: 'Please provide a valid email address.' };
  }
  try {
    const { data, error } = await client.functions.invoke('password-reset', {
      body: {
        action: 'request',
        email: trimmedEmail,
        origin: typeof window !== 'undefined' ? window.location.origin : ''
      }
    });
    if (error) {
      return { success: false, message: error.message || 'Could not start the password reset.' };
    }
    const res = data as any;
    return {
      success: !!res?.success,
      message: res?.message || 'Please check your email for the reset link.',
      link: res?.link
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not start the password reset.' };
  }
}

/**
 * Sends (or resends) the email verification link a branch admin needs before
 * they are allowed to sign in.
 */
export async function sendAdminVerificationEmail(
  email: string,
  name?: string,
  isSignup = false
): Promise<{ success: boolean; message: string; link?: string; alreadyVerified?: boolean }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Cannot reach the system right now. Please try again shortly.' };
  }
  const trimmedEmail = (email || '').trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, message: 'Please provide a valid email address.' };
  }
  try {
    const { data, error } = await client.functions.invoke('verify-email', {
      body: {
        action: 'send',
        email: trimmedEmail,
        name: name || '',
        signup: isSignup,
        origin: typeof window !== 'undefined' ? window.location.origin : ''
      }
    });
    if (error) {
      return { success: false, message: error.message || 'Could not send the verification email.' };
    }
    const res = data as any;
    return {
      success: !!res?.success,
      message: res?.message || 'Please check your email for the verification link.',
      link: res?.link,
      alreadyVerified: !!res?.alreadyVerified
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not send the verification email.' };
  }
}

export async function confirmPasswordReset(token: string, password: string): Promise<{ success: boolean; message: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Cannot reach the system right now. Please try again shortly.' };
  }
  try {
    const { data, error } = await client.functions.invoke('password-reset', {
      body: { action: 'confirm', token, password }
    });
    if (error) {
      return { success: false, message: error.message || 'Could not change the password.' };
    }
    const res = data as any;
    return { success: !!res?.success, message: res?.message || 'Password updated.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not change the password.' };
  }
}



/**
 * Notifies the church's registered admin by email that a member just self
 * checked in, via the `send-attendance-email` edge function (Resend-backed).
 * Best-effort: failures here should never block the attendance flow itself.
 */
export async function sendAttendanceEmailToChurchAdmin(params: {
  churchName: string;
  memberName: string;
  memberId: string;
  serviceType: string;
  timestamp: string;
  qrPassBase64?: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Database connection is not initialized.' };
  }

  try {
    const { data, error } = await client.functions.invoke('send-attendance-email', {
      body: params,
    });

    if (error) {
      console.warn('send-attendance-email edge function error:', error.message);
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      console.warn('send-attendance-email returned failure:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error invoking send-attendance-email:', err);
    return { success: false, error: err?.message || 'Failed to notify church admin by email.' };
  }
}

// ============================================================================
// 8. ANNOUNCEMENTS / BROADCASTS CRUD
// ============================================================================

export async function saveAnnouncementToSupabase(title: string, message: string, targetAudience: string, sender: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const payload = {
      title,
      message,
      target_audience: targetAudience
    };

    const { error } = await client.from('announcements').insert(payload);
    if (error) {
      console.warn('Supabase saveAnnouncement error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveAnnouncementToSupabase:', err);
    return false;
  }
}

// ============================================================================
// 9. FULL LOCAL DATA PUSH / SYNC TO LIVE SUPABASE
// ============================================================================

export async function pushAllLocalDataToSupabase(
  churches: ChurchBranch[],
  churchAdmins: ChurchAdminAccount[],
  leaders: Leader[],
  members: Member[],
  attendance: AttendanceRecord[]
): Promise<{ success: boolean; pushedCount: { churches: number; leaders: number; members: number; attendance: number }; error?: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, pushedCount: { churches: 0, leaders: 0, members: 0, attendance: 0 }, error: 'Client not initialized' };
  }

  let churchesPushed = 0;
  let leadersPushed = 0;
  let membersPushed = 0;
  let attendancePushed = 0;

  try {
    // 1. Push Churches
    for (const church of churches) {
      const ok = await saveChurchToSupabase(church);
      if (ok) churchesPushed++;
    }

    // 2. Push Admins
    for (const admin of churchAdmins) {
      await saveChurchAdminToSupabase(admin);
    }

    // 3. Push Leaders
    for (const leader of leaders) {
      const ok = await saveLeaderToSupabase(leader);
      if (ok) leadersPushed++;
    }

    // 4. Push Members
    for (const member of members) {
      const ok = await saveMemberToSupabase(member);
      if (ok) membersPushed++;
    }

    // 5. Push Attendance
    for (const att of attendance) {
      const ok = await saveAttendanceToSupabase(att);
      if (ok) attendancePushed++;
    }

    // Log the sync action in Supabase
    await saveAuditLogToSupabase({
      id: `log-${Date.now()}`,
      action: `Synchronized full project dataset to Supabase PostgreSQL (${membersPushed} members, ${leadersPushed} leaders, ${churchesPushed} churches)`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      icon: 'cloud_sync',
      user: 'Administrator',
      category: 'System'
    });

    return {
      success: true,
      pushedCount: {
        churches: churchesPushed,
        leaders: leadersPushed,
        members: membersPushed,
        attendance: attendancePushed
      }
    };
  } catch (err: any) {
    console.error('Error in pushAllLocalDataToSupabase:', err);
    return {
      success: false,
      pushedCount: {
        churches: churchesPushed,
        leaders: leadersPushed,
        members: membersPushed,
        attendance: attendancePushed
      },
      error: err?.message || 'Failed to sync with Supabase tables.'
    };
  }
}

// ---------- Member photos (optional profile picture) ----------
// The bucket is private, so we store the object path on the member row and
// mint short-lived signed URLs when a photo needs to be shown.
export async function uploadProfilePhoto(folder: string, file: File): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeFolder = (folder || 'profile').replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${safeFolder}/${Date.now()}.${ext}`;
    const { error } = await client.storage.from('member-photos').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined
    });
    if (error) {
      console.warn('uploadProfilePhoto error:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error('Error in uploadProfilePhoto:', err);
    return null;
  }
}

export async function uploadMemberPhoto(memberId: string, file: File): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${memberId}/${Date.now()}.${ext}`;
    const { error } = await client.storage.from('member-photos').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined
    });
    if (error) {
      console.warn('uploadMemberPhoto error:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error('Error in uploadMemberPhoto:', err);
    return null;
  }
}

const signedPhotoCache = new Map<string, string>();
export async function getMemberPhotoUrl(path?: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  if (signedPhotoCache.has(path)) return signedPhotoCache.get(path)!;
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data } = await client.storage.from('member-photos').createSignedUrl(path, 60 * 60);
    const url = (data as any)?.signedUrl || null;
    if (url) signedPhotoCache.set(path, url);
    return url;
  } catch {
    return null;
  }
}

// ---------- Absentees & follow-up ----------
export interface AbsenceRecord {
  id: string;
  memberId: string;
  memberName: string;
  church: string;
  serviceType: string;
  serviceDate: string;
  reason?: string;
  note?: string;
  recordedBy?: string;
}

export async function fetchAbsenceRecords(): Promise<AbsenceRecord[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('absence_records')
      .select('*')
      .order('service_date', { ascending: false });
    if (error) {
      console.warn('fetchAbsenceRecords error:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      church: row.church_name || 'Unassigned',
      serviceType: row.service_type,
      serviceDate: row.service_date,
      reason: row.reason || undefined,
      note: row.note || undefined,
      recordedBy: row.recorded_by || undefined
    }));
  } catch {
    return [];
  }
}

export async function saveAbsenceFollowUp(entry: {
  memberId: string;
  memberName: string;
  church: string;
  serviceType: string;
  serviceDate: string;
  reason: string;
  note?: string;
  recordedBy?: string;
}): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const payload = {
      member_id: entry.memberId,
      member_name: entry.memberName,
      church_id: await resolveChurchId(entry.church),
      church_name: entry.church,
      service_type: entry.serviceType,
      service_date: entry.serviceDate,
      reason: entry.reason,
      note: entry.note || null,
      recorded_by: entry.recordedBy || null
    };
    const { error } = await client
      .from('absence_records')
      .upsert(payload, { onConflict: 'member_id,service_type,service_date' });
    if (error) {
      console.warn('saveAbsenceFollowUp error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveAbsenceFollowUp:', err);
    return false;
  }
}

// ============================================================================
// BULK QR PASS EMAILS + SPREADSHEET IMPORT
// ============================================================================

export interface QrPassRecipient {
  id: string;
  name: string;
  email: string;
  church?: string;
  role?: string;
}

export interface QrPassEmailResult {
  success: boolean;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
}

/** Emails each person their attendance code. Safe to run again. */
export async function sendQrPassEmails(recipients: QrPassRecipient[]): Promise<QrPassEmailResult> {
  const client = getSupabase();
  const valid = (recipients || []).filter((r) => r && r.id && r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
  const skippedUpfront = (recipients || []).length - valid.length;

  if (!client) return { success: false, sent: 0, skipped: skippedUpfront, failed: valid.length, error: 'Not connected.' };
  if (!valid.length) return { success: true, sent: 0, skipped: skippedUpfront, failed: 0 };

  try {
    const { data, error } = await client.functions.invoke('send-qr-passes', {
      body: { recipients: valid },
    });
    if (error) {
      return { success: false, sent: 0, skipped: skippedUpfront, failed: valid.length, error: error.message };
    }
    return {
      success: true,
      sent: (data as any)?.sent || 0,
      skipped: ((data as any)?.skipped || 0) + skippedUpfront,
      failed: (data as any)?.failed || 0,
    };
  } catch (err: any) {
    return { success: false, sent: 0, skipped: skippedUpfront, failed: valid.length, error: err?.message || 'Failed to send.' };
  }
}
