/**
 * COMPLETE POSTGRESQL / SUPABASE DATABASE SCHEMA FOR
 * CHRIST EMBASSY KORLE BU (CEKB GROUP) ATTENDANCE & CHURCH MANAGEMENT PORTAL
 *
 * Instructions:
 * 1. Open your Supabase Dashboard -> SQL Editor -> New Query
 * 2. Paste this entire SQL script and click "Run"
 * 3. Safe to run on both a fresh database and an existing database (idempotent)
 */

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- CHRIST EMBASSY KORLE BU (CEKB GROUP) - COMPLETE DATABASE SCHEMA & UPDATE SQL
-- Safe to run on both a fresh database and an existing database (idempotent)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. ENUM TYPES & ROLE EXTENSIONS
DO $$ BEGIN
    CREATE TYPE public.user_role_enum AS ENUM ('Superadmin','Church Pastor','Church Admin','Leader','Usher','Developer','Member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Church Pastor';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Developer';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'Member';

DO $$ BEGIN
    CREATE TYPE public.leader_type_enum AS ENUM ('BSCT','Cell Leader','PCF Leader','Church Coordinator');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.promotion_status_enum AS ENUM ('None','Flagged','Confirmed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.member_status_enum AS ENUM ('First Timer','General Member','Alumni');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. CHURCHES (MULTI-TENANCY ROOT)
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    pastor_name VARCHAR(255) NOT NULL DEFAULT 'Pastor in Charge',
    members_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    zone VARCHAR(100) NOT NULL DEFAULT 'Zone 1 (Korle Bu)',
    service_start_times JSONB NOT NULL DEFAULT '{"Sunday Service":"08:00","Midweek Service":"18:00"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.churches
    ADD COLUMN IF NOT EXISTS service_start_times JSONB NOT NULL
    DEFAULT '{"Sunday Service":"08:00","Midweek Service":"18:00"}'::jsonb;

-- 3. USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role public.user_role_enum NOT NULL DEFAULT 'Church Admin',
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name VARCHAR(255),
    zone VARCHAR(100) DEFAULT 'Zone 1 (Korle Bu)',
    avatar_url TEXT,
    phone VARCHAR(50),
    is_church_admin BOOLEAN DEFAULT FALSE,
    admin_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    email_verification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
    ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

-- 4. CHURCH ADMIN ACCOUNTS DIRECTORY
CREATE TABLE IF NOT EXISTS public.church_admin_accounts (
    id VARCHAR(100) PRIMARY KEY,
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(50),
    password VARCHAR(255),
    zone VARCHAR(100) DEFAULT 'Zone 1 (Korle Bu)',
    role VARCHAR(50) DEFAULT 'Church Admin',
    status VARCHAR(50) DEFAULT 'Active',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token TEXT,
    email_verification_sent_at TIMESTAMPTZ,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_church_admin_email UNIQUE (admin_email)
);

-- 5. LEADERS HIERARCHY TREE
CREATE TABLE IF NOT EXISTS public.leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    contact VARCHAR(50),
    dob DATE,
    location VARCHAR(255),
    leader_type public.leader_type_enum NOT NULL DEFAULT 'BSCT',
    cell_or_pcf_name VARCHAR(255),
    parent_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    is_appointed BOOLEAN DEFAULT FALSE,
    downstream_count INT NOT NULL DEFAULT 0,
    promotion_status public.promotion_status_enum NOT NULL DEFAULT 'None',
    marital_status TEXT,
    department TEXT,
    gender TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MEMBERS DIRECTORY
CREATE TABLE IF NOT EXISTS public.members (
    id VARCHAR(50) PRIMARY KEY,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name VARCHAR(255) DEFAULT 'GCYC Main',
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) DEFAULT 'Male',
    email VARCHAR(255),
    phone VARCHAR(50),
    dob DATE,
    role VARCHAR(50) DEFAULT 'Member',
    occupation VARCHAR(100) DEFAULT 'General',
    education_level VARCHAR(100) DEFAULT 'Tertiary',
    location VARCHAR(255) DEFAULT 'Korle Bu',
    invited_by_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    invited_by_name VARCHAR(255),
    pcf_leader TEXT,
    cell_leader TEXT,
    bsct_leader TEXT,
    marital_status TEXT,
    photo_url TEXT,
    service_count INT NOT NULL DEFAULT 1,
    foundation_class INT NOT NULL DEFAULT 0,
    status public.member_status_enum NOT NULL DEFAULT 'First Timer',
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SERVICE TYPES
CREATE TABLE IF NOT EXISTS public.service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_global BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_types_name UNIQUE (name)
);

-- 8. ATTENDANCE RECORDS
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('ATT-' || gen_random_uuid()::text),
    member_id VARCHAR(50) REFERENCES public.members(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    member_role VARCHAR(50) DEFAULT 'Member',
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name VARCHAR(255),
    service_type VARCHAR(255) NOT NULL,
    service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
    leader_name VARCHAR(255) DEFAULT 'Direct / Self',
    pcf_name VARCHAR(255) DEFAULT 'General PCF',
    check_in_method VARCHAR(50) DEFAULT 'QR Scan',
    verified_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Confirmed',
    checked_in_time VARCHAR(20),
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;

-- 9. ABSENCE RECORDS
CREATE TABLE IF NOT EXISTS public.absence_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name TEXT,
    service_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    reason TEXT,
    note TEXT,
    recorded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (member_id, service_type, service_date)
);

-- 10. WEEKLY CELL REPORTS
CREATE TABLE IF NOT EXISTS public.cell_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name TEXT NOT NULL,
    leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    leader_name TEXT NOT NULL,
    leader_role TEXT NOT NULL,
    cell_name TEXT NOT NULL,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meeting_type TEXT NOT NULL,
    total_cell_members INT NOT NULL DEFAULT 0,
    cell_attendance INT NOT NULL DEFAULT 0,
    sunday_attendance INT NOT NULL DEFAULT 0,
    first_timers INT NOT NULL DEFAULT 0,
    new_converts INT NOT NULL DEFAULT 0,
    offering NUMERIC(12,2) DEFAULT 0,
    souls_won INT NOT NULL DEFAULT 0,
    outreaches_held INT NOT NULL DEFAULT 0,
    attendee_names TEXT,
    testimonies TEXT,
    challenges TEXT,
    notes TEXT,
    submitted_by_phone TEXT,
    submitted_by_email TEXT
);

-- 11. ANNOUNCEMENTS, AUDIT LOGS & ADMIN SETTINGS
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    sender_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_audience VARCHAR(100) NOT NULL DEFAULT 'All Members',
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(255) NOT NULL,
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name VARCHAR(255),
    action TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'System',
    icon VARCHAR(50) DEFAULT 'info',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(100) DEFAULT 'global',
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'json',
    is_global BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_settings_key UNIQUE (setting_key)
);

-- 12. QR TOKENS, PORTAL SESSIONS, LOGIN OTPS & PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id VARCHAR(50) REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portal_sessions (
    token TEXT PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    church TEXT,
    leader_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 hours')
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON public.portal_sessions(expires_at);

CREATE TABLE IF NOT EXISTS public.login_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_otps_email_created ON public.login_otps(lower(email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. RATE LIMITING & EMAIL TELEMETRY
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    id BIGSERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    subject TEXT NOT NULL,
    hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_subject_time
    ON public.rate_limit_hits(bucket, subject, hit_at DESC);

CREATE TABLE IF NOT EXISTS public.email_send_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT,
    template_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_send_log_created_at ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON public.email_send_log(status);

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_cron_tokens (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SEED / MERGE DEVELOPER PLATFORM SETTINGS & FEATURE MATRIX
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
`;
