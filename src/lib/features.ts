// Feature catalogue keyed by dashboard view id; the developer console toggles these per role.
export const FEATURES: { id: string; label: string }[] = [
  { id: 'group_overview', label: 'Churches overview' },
  { id: 'church_admins_directory', label: 'Church admins directory' },
  { id: 'leaders', label: 'Leaders directory' },
  { id: 'hierarchy', label: 'Leader hierarchy' },
  { id: 'leader_registration', label: 'Register leaders' },
  { id: 'members', label: 'Members database' },
  { id: 'attendance', label: 'Attendance records' },
  { id: 'cell_reports', label: 'Weekly cell reports' },
  { id: 'analytics', label: 'Insights & analytics' },
  { id: 'scanner', label: 'QR scanner' },
  { id: 'export', label: 'Export records' },
  { id: 'support', label: 'Admin support chat' },
];
export const FEATURE_ROLES = ['Superadmin', 'Church Pastor', 'Church Admin', 'Leader', 'Usher'] as const;
export const ROLE_LABELS: Record<string, string> = { Superadmin: 'Group Pastor', 'Church Pastor': 'Church Pastor', 'Church Admin': 'Church Admin', Leader: 'Leader', Usher: 'Usher' };
export type FeatureMatrix = Record<string, Record<string, boolean>>;
export const isFeatureOn = (m: FeatureMatrix | null | undefined, role: string | undefined, id: string) =>
  !m || !role || m[role]?.[id] !== false;
