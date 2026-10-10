// Reads the developer-controlled platform settings (admin_settings.platform_config).
import { createClient } from 'npm:@supabase/supabase-js@2';

export interface PlatformConfig {
  platformName: string; tagline: string; supportEmail: string; senderName: string; primaryColor: string;
  maintenance: boolean; maintenanceMessage: string; announcementBanner: string;
  allowRegistrations: boolean; allowLeaderSignup: boolean; allowSelfRegistration: boolean; allowSelfCheckin: boolean;
  allowCellReports: boolean; allowUsherAccounts: boolean;
  sessionHours: number; requireGroupOtp: boolean; maxChurches: number; plan: string;
  birthdayEmails: boolean; weeklySummary: boolean; reportReminders: boolean; welcomeEmails: boolean;
  timezone: string; currency: string; auditRetentionDays: number;
}

export const PLATFORM_DEFAULTS: PlatformConfig = {
  platformName: 'CEKB Group', tagline: 'Every presence counts.', supportEmail: 'support@gcycattendance.online', senderName: 'CE Korle Bu', primaryColor: '#000f22',
  maintenance: false, maintenanceMessage: 'We are making improvements. Please check back shortly.', announcementBanner: '',
  allowRegistrations: true, allowLeaderSignup: true, allowSelfRegistration: true, allowSelfCheckin: true,
  allowCellReports: true, allowUsherAccounts: true,
  sessionHours: 12, requireGroupOtp: true, maxChurches: 100, plan: 'Free',
  birthdayEmails: true, weeklySummary: true, reportReminders: true, welcomeEmails: true,
  timezone: 'Africa/Accra', currency: 'GHS', auditRetentionDays: 365,
};

export async function getPlatformConfig(db?: any): Promise<PlatformConfig> {
  const client = db || createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await client.from('admin_settings').select('setting_value').eq('setting_key', 'platform_config').maybeSingle();
  return { ...PLATFORM_DEFAULTS, ...((data?.setting_value as Partial<PlatformConfig>) || {}) };
}
