export type ViewType = 
  | 'home'
  | 'login'
  | 'admin_signup'
  | 'self_attendance'
  | 'leader_self_reg'
  | 'dashboard'
  | 'group_overview'
  | 'members'
  | 'leaders'
  | 'leader_registration'
  | 'attendance'
  | 'reports'
  | 'analytics'
  | 'qr_scanner'
  | 'register'
  | 'database_schema'
  | 'settings'
  | 'cell_reports'
  | 'church_admins_directory'
  | 'hierarchy';

export interface CellReportGridCell {
  cell: string;
  outreach: string;
}

export interface CellReport {
  id: string;
  church: string;
  leaderName: string;
  cellName: string;
  outreachCentre: string;
  reportDate: string;
  reportGrid: Record<string, CellReportGridCell>;
  evangelism: Record<string, string>;
  soulsWonList: Array<Record<string, any>>;
  cellAttendance: Array<Record<string, any>>;
  sundayRegister: Array<Record<string, any>>;
  totalAttendance: number;
  totalFirstTimers: number;
  totalSoulsWon: number;
  totalOffering: number;
  submittedBy: string;
  createdAt: string;
}

export interface ChurchAdminAccount {
  id: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  churchName: string;
  zone: string;
  joinedDate: string;
  status: 'Active' | 'Pending Verification';
  password?: string;
  photoUrl?: string;
  /** Church pastors register the church; church admins are appointed by them. */
  accountRole?: 'Church Pastor' | 'Church Admin';
}

export type RoleType = 'Leader' | 'Member' | 'First Timer';

export type LeaderType = 'BSCT' | 'Cell Leader' | 'PCF Leader' | 'Church Coordinator';

export interface Leader {
  id: string;
  fullName: string;
  email: string;
  contact: string;
  dob: string;
  location: string;
  leaderType: LeaderType;
  cellOrPcfName: string;
  church: string;
  parentLeaderId?: string;
  parentLeaderName?: string;
  isAppointed: boolean; // True if appointed without completing hierarchy
  downstreamCount: number;
  promotionStatus: 'None' | 'Flagged' | 'Confirmed';
  joinedDate: string;
  initials: string;
  photoUrl?: string;
  leaderCode?: string;
}

export interface Member {
  id: string; // e.g. CE-2901
  fullName: string;
  phone: string;
  email?: string;
  dob?: string;
  role: RoleType;
  occupation: string;
  education: string;
  location: string;
  church: string;
  invitedBy?: string; // Leader name or Self-Walkin
  invitedByLeaderId?: string;
  joinDate: string;
  avatarColor?: string;
  initials: string;
  downstreamCount?: number;
  serviceCount: number; // 1 to 3 -> flips from First Timer to General Member at 3
  foundationClass: number; // 0 to 7
  status: 'First Timer' | 'General Member';
  gender?: 'Male' | 'Female';
  maritalStatus?: string;
  photoUrl?: string;
  educationLevel?: string;
  occupationCategory?: string;
}

export interface ServiceTypeItem {
  id: string;
  name: string;
  churchId?: string; // Null for global superadmin service types
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberRole: RoleType;
  serviceType: string;
  timestamp: string;
  date?: string; // YYYY-MM-DD for date filtering and archiving
  verifiedBy: string;
  status: 'Confirmed' | 'Pending';
  church: string;
  checkInMethod: 'QR Scan' | 'Manual Admin' | 'Self Check-In' | 'First Signup';
  leaderName?: string; // Member's assigned leader or PCF leader
  pcfName?: string; // Member's PCF or Cell name
}

export interface ChurchBranch {
  id: string;
  name: string;
  pastor: string;
  membersCount: number;
  status: 'Healthy' | 'Review' | 'Growing';
  zone: string;
  pcfCount: number;
  cellCount: number;
  bsctCount: number;
}

export interface TopLeader {
  id: string;
  name: string;
  initials: string;
  downstreamCount: number;
  branch: string;
  role: LeaderType;
}

export interface PromotionQueueItem {
  id: string;
  leaderId: string;
  leaderName: string;
  church: string;
  currentRole: LeaderType;
  targetRole: LeaderType;
  downstreamCount: number;
  flaggedAt: string;
  reason: string;
  memberId?: string;
  requestedBy?: string;
  status?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  timestamp: string;
  icon: string;
  user?: string;
  church?: string;
  category?: 'Check-in' | 'Leader' | 'Member' | 'System' | 'Announcement' | 'Security';
}

export interface UserProfile {
  name: string;
  email: string;
  role: 'Superadmin' | 'Church Admin' | 'Church Pastor' | 'Leader';
  church: string;
  avatarUrl?: string;
  isSuperadmin?: boolean;
  zone?: string;
  phone?: string;
  avatar?: string;
  id?: string;
}

export interface AuthSessionUser {
  id: string;
  name: string;
  role: 'Superadmin' | 'Church Admin' | 'Church Pastor' | 'Leader' | 'Usher';
  church: string;
  zone: string;
  avatar: string;
  email: string;
  phone?: string;
}

export interface AdminSettings {
  id: string;
  adminId: string;
  settingKey: string;
  settingValue: string | boolean | number | Record<string, any>;
  settingType: 'string' | 'boolean' | 'json' | 'number';
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertNotification {
  id: string;
  action: string;
  timestamp: string;
  icon: string;
  user?: string;
  church?: string;
  category?: 'Check-in' | 'Leader' | 'Member' | 'System' | 'Announcement' | 'Security';
  isRead: boolean;
  readAt?: string;
}
