-- ============================================================================
-- Migration 0005: Developer Console, Platform Settings & Audit Log Categories
-- ============================================================================

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('Superadmin', 'Church Pastor', 'Church Admin', 'Usher', 'Leader', 'Member', 'Developer'));

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_category_check
    CHECK (category IN ('Member', 'Leader', 'Check-in', 'Security', 'System', 'Settings', 'Church', 'Export', 'Import', 'General'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'platform_config',
    '{
        "platformName": "CEKB Group",
        "tagline": "Every presence counts.",
        "supportEmail": "support@gcycattendance.online",
        "senderName": "CE Korle Bu",
        "primaryColor": "#000f22",
        "maintenance": false,
        "maintenanceMessage": "We are making improvements. Please check back shortly.",
        "announcementBanner": "",
        "allowRegistrations": true,
        "allowLeaderSignup": true,
        "allowSelfRegistration": true,
        "allowSelfCheckin": true,
        "allowCellReports": true,
        "allowUsherAccounts": true,
        "sessionHours": 12,
        "requireGroupOtp": true,
        "maxChurches": 100,
        "plan": "Free",
        "birthdayEmails": true,
        "weeklySummary": true,
        "reportReminders": true,
        "welcomeEmails": true,
        "timezone": "Africa/Accra",
        "currency": "GHS",
        "auditRetentionDays": 365
    }'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = (
    '{
        "platformName": "CEKB Group",
        "tagline": "Every presence counts.",
        "supportEmail": "support@gcycattendance.online",
        "senderName": "CE Korle Bu",
        "primaryColor": "#000f22",
        "maintenance": false,
        "maintenanceMessage": "We are making improvements. Please check back shortly.",
        "announcementBanner": "",
        "allowRegistrations": true,
        "allowLeaderSignup": true,
        "allowSelfRegistration": true,
        "allowSelfCheckin": true,
        "allowCellReports": true,
        "allowUsherAccounts": true,
        "sessionHours": 12,
        "requireGroupOtp": true,
        "maxChurches": 100,
        "plan": "Free",
        "birthdayEmails": true,
        "weeklySummary": true,
        "reportReminders": true,
        "welcomeEmails": true,
        "timezone": "Africa/Accra",
        "currency": "GHS",
        "auditRetentionDays": 365
    }'::jsonb || COALESCE(public.admin_settings.setting_value, '{}'::jsonb)
),
is_global = true,
updated_at = NOW();
