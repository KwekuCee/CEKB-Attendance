type AccountMetricProfile = {
  role: string;
  church_name: string | null;
  admin_verified: boolean | null;
};

export function summarizeDeveloperAccounts(profiles: AccountMetricProfile[]) {
  const roleCounts: Record<string, number> = {};
  const staffByChurch: Record<string, number> = {};
  let pendingCount = 0;

  for (const profile of profiles) {
    roleCounts[profile.role] = (roleCounts[profile.role] || 0) + 1;
    const churchKey = String(profile.church_name || '').trim().toLowerCase();
    if (churchKey) staffByChurch[churchKey] = (staffByChurch[churchKey] || 0) + 1;
    if (profile.admin_verified === false) pendingCount++;
  }

  return { roleCounts, staffByChurch, pendingCount };
}
