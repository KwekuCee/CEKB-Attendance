-- ============================================================================
-- Migration: Developer Console, Platform Settings, Audit Categories & Schema Sync
-- ============================================================================

-- 1. Ensure user_profiles supports Church Pastor and Developer roles
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('Superadmin', 'Church Pastor', 'Church Admin', 'Usher', 'Leader', 'Member', 'Developer'));

-- 2. Ensure audit_logs supports Settings and Church categories for Developer Console
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_category_check
    CHECK (category IN ('Member', 'Leader', 'Check-in', 'Security', 'System', 'Settings', 'Church', 'Export', 'Import', 'General'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

-- 3. Ensure admin_settings has unique setting_key for upsert operations (platform_config, feature_matrix, backup/restore)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admin_settings_setting_key_key'
          AND conrelid = 'public.admin_settings'::regclass
    ) THEN
        ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_setting_key_key UNIQUE (setting_key);
    END IF;
END $$;

-- 4. Seed default global platform_config (merged if already present)
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

-- 5. Seed default role feature_matrix if not yet configured
INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'feature_matrix',
    '{
        "Superadmin": {"dashboard":true,"group":true,"attendance":true,"hierarchy_attendance":true,"absentees":true,"cell_reports":true,"members":true,"birthdays":true,"classes":true,"leaders":true,"hierarchy":true,"incomplete_leaders":true,"import":true,"admins":true,"analytics":true,"insights":true,"settings":true,"qr_scanner":true,"announcements":true},
        "Church Pastor": {"dashboard":true,"group":false,"attendance":true,"hierarchy_attendance":true,"absentees":true,"cell_reports":true,"members":true,"birthdays":true,"classes":true,"leaders":true,"hierarchy":true,"incomplete_leaders":true,"import":true,"admins":false,"analytics":true,"insights":true,"settings":true,"qr_scanner":true,"announcements":true},
        "Church Admin": {"dashboard":true,"group":false,"attendance":true,"hierarchy_attendance":true,"absentees":true,"cell_reports":true,"members":true,"birthdays":true,"classes":true,"leaders":true,"hierarchy":false,"incomplete_leaders":true,"import":true,"admins":false,"analytics":true,"insights":true,"settings":true,"qr_scanner":true,"announcements":false},
        "Leader": {"dashboard":false,"group":false,"attendance":true,"hierarchy_attendance":false,"absentees":false,"cell_reports":false,"members":false,"birthdays":false,"classes":false,"leaders":false,"hierarchy":false,"incomplete_leaders":false,"import":false,"admins":false,"analytics":false,"insights":false,"settings":false,"qr_scanner":false,"announcements":false},
        "Usher": {"dashboard":false,"group":false,"attendance":true,"hierarchy_attendance":false,"absentees":false,"cell_reports":false,"members":false,"birthdays":false,"classes":false,"leaders":false,"hierarchy":false,"incomplete_leaders":false,"import":false,"admins":false,"analytics":false,"insights":false,"settings":false,"qr_scanner":true,"announcements":false}
    }'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;
