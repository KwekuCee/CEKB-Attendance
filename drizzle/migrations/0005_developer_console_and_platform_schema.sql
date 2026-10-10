-- ============================================================================
-- Migration 0005: Developer Console, Platform Settings & Audit Log Categories
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Church Pastor';
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Developer';
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Member';
    END IF;
END $$;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;

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
    EXCLUDED.setting_value || COALESCE(public.admin_settings.setting_value, '{}'::jsonb)
),
is_global = true,
updated_at = NOW();

INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'feature_matrix',
    '{
        "Superadmin": {"group_overview":true,"church_admins_directory":true,"leaders":true,"hierarchy":true,"leader_registration":true,"members":true,"attendance":true,"cell_reports":true,"analytics":true,"scanner":true,"export":true,"support":true},
        "Church Pastor": {"group_overview":false,"church_admins_directory":false,"leaders":true,"hierarchy":true,"leader_registration":true,"members":true,"attendance":true,"cell_reports":true,"analytics":true,"scanner":true,"export":true,"support":true},
        "Church Admin": {"group_overview":false,"church_admins_directory":false,"leaders":true,"hierarchy":false,"leader_registration":true,"members":true,"attendance":true,"cell_reports":true,"analytics":true,"scanner":true,"export":true,"support":true},
        "Leader": {"group_overview":false,"church_admins_directory":false,"leaders":false,"hierarchy":false,"leader_registration":false,"members":false,"attendance":true,"cell_reports":false,"analytics":false,"scanner":false,"export":false,"support":false},
        "Usher": {"group_overview":false,"church_admins_directory":false,"leaders":false,"hierarchy":false,"leader_registration":false,"members":false,"attendance":true,"cell_reports":false,"analytics":false,"scanner":true,"export":false,"support":false}
    }'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;
