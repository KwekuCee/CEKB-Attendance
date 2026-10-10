-- ============================================================================
-- Migration: Developer Console, Platform Settings, Audit Categories & Schema Sync
-- Safe to run on your existing Supabase database (idempotent)
-- ============================================================================

-- 1. Extend user_role_enum with Church Pastor, Developer, and Member
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Church Pastor';
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Developer';
        ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Member';
    END IF;
END $$;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 2. Ensure churches has per-service start times for on-time vs late check-in tracking
ALTER TABLE public.churches
    ADD COLUMN IF NOT EXISTS service_start_times JSONB NOT NULL
    DEFAULT '{"Sunday Service":"08:00","Midweek Service":"18:00"}'::jsonb;

-- 3. Ensure attendance_records has the is_late flag
ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;

-- 4. Ensure audit_logs allows all Developer Console & Portal categories
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

-- 5. Ensure login_otps table exists for Group Pastor two-step email verification
CREATE TABLE IF NOT EXISTS public.login_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_otps_email_created ON public.login_otps(lower(email), created_at DESC);
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;

-- 6. Ensure admin_settings has a unique constraint on setting_key for console upserts & restores
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.admin_settings'::regclass
          AND contype = 'u'
          AND conname IN ('uq_admin_settings_key', 'admin_settings_setting_key_key')
    ) THEN
        ALTER TABLE public.admin_settings ADD CONSTRAINT uq_admin_settings_key UNIQUE (setting_key);
    END IF;
END $$;

-- 7. Seed / merge all 23 platform_config keys for the Developer Console Settings page
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

-- 8. Seed default role feature_matrix if not already present
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
