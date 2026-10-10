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
-- Includes: Core Tables, Leader Hierarchy, Cell Reports, Portal Sessions,
-- Login OTPs, Rate Limiting, Email Logs, Triggers, RLS & Platform Settings
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CHURCHES (BRANCHES) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    pastor TEXT NOT NULL,
    zone TEXT NOT NULL DEFAULT 'CEKB Group',
    location TEXT NOT NULL DEFAULT 'Korle Bu, Accra',
    members_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    service_start_times JSONB NOT NULL DEFAULT '{"Sunday Service":"08:00","Midweek Service":"18:00"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.churches
    ADD COLUMN IF NOT EXISTS service_start_times JSONB NOT NULL DEFAULT '{"Sunday Service":"08:00","Midweek Service":"18:00"}'::jsonb;

-- ============================================================================
-- 2. USER PROFILES & ROLE-BASED ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('Superadmin', 'Church Pastor', 'Church Admin', 'Usher', 'Leader', 'Member', 'Developer')),
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name TEXT,
    zone TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Pending')),
    email_verified BOOLEAN DEFAULT false,
    admin_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    email_verification_sent_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('Superadmin', 'Church Pastor', 'Church Admin', 'Usher', 'Leader', 'Member', 'Developer'));

-- ============================================================================
-- 3. CHURCH ADMIN ACCOUNTS DIRECTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.church_admin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name TEXT NOT NULL,
    pastor TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    admin_email TEXT UNIQUE NOT NULL,
    admin_phone TEXT,
    password_hash TEXT,
    zone TEXT NOT NULL DEFAULT 'CEKB Group',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    email_verification_sent_at TIMESTAMPTZ,
    last_login TEXT DEFAULT 'Never',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. LEADERS DIRECTORY & HIERARCHY TABLE (PCF -> Cell -> BSCT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Senior Cell Leader', 'PCF Leader', 'Cell Leader', 'BSCT Leader')),
    group_name TEXT,
    parent_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    email TEXT,
    phone TEXT NOT NULL,
    password_hash TEXT,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name TEXT NOT NULL,
    zone TEXT,
    assigned_members INTEGER DEFAULT 0,
    attendance_rate NUMERIC(5,2) DEFAULT 0.00,
    follow_up_success NUMERIC(5,2) DEFAULT 0.00,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Training', 'Inactive')),
    avatar_url TEXT,
    birthday TEXT,
    birth_day INTEGER CHECK (birth_day BETWEEN 1 AND 31),
    birth_month INTEGER CHECK (birth_month BETWEEN 1 AND 12),
    gender TEXT,
    marital_status TEXT,
    occupation TEXT,
    department TEXT,
    residing_area TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leaders
    ADD COLUMN IF NOT EXISTS group_name TEXT,
    ADD COLUMN IF NOT EXISTS parent_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS birthday TEXT,
    ADD COLUMN IF NOT EXISTS birth_day INTEGER,
    ADD COLUMN IF NOT EXISTS birth_month INTEGER,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS marital_status TEXT,
    ADD COLUMN IF NOT EXISTS occupation TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS residing_area TEXT;

CREATE INDEX IF NOT EXISTS idx_leaders_parent_leader_id ON public.leaders(parent_leader_id);

-- ============================================================================
-- 5. MEMBERS & FIRST-TIMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    role TEXT DEFAULT 'General Member',
    status TEXT NOT NULL DEFAULT 'First Timer' CHECK (status IN ('Member', 'First Timer', 'New Convert', 'Visitor', 'Consistent', 'Irregular')),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name TEXT NOT NULL,
    zone TEXT,
    leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    leader_name TEXT,
    pcf_leader TEXT,
    cell_leader TEXT,
    bsct_leader TEXT,
    residing_area TEXT,
    department TEXT DEFAULT 'None',
    occupation TEXT,
    marital_status TEXT DEFAULT 'Single',
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    birthday TEXT,
    birth_day INTEGER CHECK (birth_day BETWEEN 1 AND 31),
    birth_month INTEGER CHECK (birth_month BETWEEN 1 AND 12),
    age_group TEXT,
    baptism_status TEXT DEFAULT 'Not Baptized',
    foundation_school TEXT DEFAULT 'Not Enrolled',
    joined_date DATE DEFAULT CURRENT_DATE,
    service_date DATE DEFAULT CURRENT_DATE,
    service_type TEXT DEFAULT 'Sunday Service',
    attendance_history BOOLEAN[] DEFAULT ARRAY[true, false, false, false, false],
    follow_up_stage INTEGER DEFAULT 1 CHECK (follow_up_stage BETWEEN 0 AND 4),
    follow_up_notes TEXT,
    prayer_request TEXT,
    qr_code_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS pcf_leader TEXT,
    ADD COLUMN IF NOT EXISTS cell_leader TEXT,
    ADD COLUMN IF NOT EXISTS bsct_leader TEXT;

CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_church_name ON public.members(church_name);
CREATE INDEX IF NOT EXISTS idx_members_leader_name ON public.members(leader_name);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_birthday ON public.members(birth_month, birth_day);

-- ============================================================================
-- 6. SERVICE ATTENDANCE RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    member_phone TEXT,
    member_role TEXT DEFAULT 'Member',
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name TEXT NOT NULL,
    leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    leader_name TEXT,
    service_type TEXT NOT NULL DEFAULT 'Sunday Service',
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TEXT NOT NULL,
    check_in_method TEXT NOT NULL DEFAULT 'Self Check-In' CHECK (check_in_method IN ('Self Check-In', 'QR Scan', 'Usher Manual', 'Bulk Import', 'First Timer Desk')),
    verified_by_usher_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified_by_usher_name TEXT,
    is_first_timer BOOLEAN DEFAULT false,
    is_late BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    checked_in_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_church ON public.attendance_records(church_name);
CREATE INDEX IF NOT EXISTS idx_attendance_service_type ON public.attendance_records(service_type);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance_records(member_id);

-- ============================================================================
-- 7. ABSENCE & FOLLOW-UP LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.absence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    member_phone TEXT,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    church_name TEXT NOT NULL,
    leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    leader_name TEXT,
    service_type TEXT NOT NULL DEFAULT 'Sunday Service',
    absence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consecutive_absences INTEGER DEFAULT 1,
    follow_up_status TEXT DEFAULT 'Pending' CHECK (follow_up_status IN ('Pending', 'Called', 'Visited', 'Message Sent', 'Resolved')),
    follow_up_assigned_to TEXT,
    follow_up_notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. WEEKLY CELL REPORTS TABLE
-- ============================================================================
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
    total_cell_members INTEGER NOT NULL DEFAULT 0,
    cell_attendance INTEGER NOT NULL DEFAULT 0,
    sunday_attendance INTEGER NOT NULL DEFAULT 0,
    first_timers INTEGER NOT NULL DEFAULT 0,
    new_converts INTEGER NOT NULL DEFAULT 0,
    offering NUMERIC(12,2) DEFAULT 0,
    souls_won INTEGER NOT NULL DEFAULT 0,
    outreaches_held INTEGER NOT NULL DEFAULT 0,
    attendee_names TEXT,
    testimonies TEXT,
    challenges TEXT,
    notes TEXT,
    submitted_by_phone TEXT,
    submitted_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_cell_reports_church_date ON public.cell_reports(church_name, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_cell_reports_leader ON public.cell_reports(leader_name);

-- ============================================================================
-- 9. GLOBAL & BRANCH SERVICE TYPES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    default_day TEXT DEFAULT 'Sunday',
    default_time TEXT DEFAULT '08:00 AM',
    is_global BOOLEAN DEFAULT true,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. ANNOUNCEMENTS & BROADCASTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_audience TEXT DEFAULT 'All Churches',
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT DEFAULT 'Superadmin',
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    actor_role TEXT DEFAULT 'Admin',
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    church_name TEXT,
    action TEXT NOT NULL,
    category TEXT DEFAULT 'System' CHECK (category IN ('Member', 'Leader', 'Check-in', 'Security', 'System', 'Settings', 'Church', 'Export', 'Import', 'General')),
    icon TEXT DEFAULT 'info',
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_category_check;
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_category_check
    CHECK (category IN ('Member', 'Leader', 'Check-in', 'Security', 'System', 'Settings', 'Church', 'Export', 'Import', 'General'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

-- ============================================================================
-- 12. SYSTEM & PLATFORM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type TEXT DEFAULT 'json',
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT true,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 13. DIGITAL QR PASS TOKENS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    token_code TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    last_scanned_at TIMESTAMPTZ,
    scan_count INTEGER DEFAULT 0,
    is_revoked BOOLEAN DEFAULT false
);

-- ============================================================================
-- 14. SERVER-VERIFIED PORTAL SESSIONS TABLE
-- ============================================================================
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

-- ============================================================================
-- 15. LOGIN TWO-STEP VERIFICATION OTPS TABLE
-- ============================================================================
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

-- ============================================================================
-- 16. RATE LIMITING TABLE & ATOMIC RPC FUNCTION
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    id BIGSERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    subject TEXT NOT NULL,
    hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_subject_time
    ON public.rate_limit_hits(bucket, subject, hit_at DESC);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_bucket TEXT,
    p_subject TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_since TIMESTAMPTZ := NOW() - make_interval(secs => p_window_seconds);
    v_count INTEGER;
    v_oldest TIMESTAMPTZ;
BEGIN
    IF random() < 0.02 THEN
        DELETE FROM public.rate_limit_hits WHERE hit_at < NOW() - INTERVAL '24 hours';
    END IF;

    SELECT COUNT(*), MIN(hit_at)
      INTO v_count, v_oldest
      FROM public.rate_limit_hits
     WHERE bucket = p_bucket
       AND subject = p_subject
       AND hit_at >= v_since;

    IF v_count >= p_limit THEN
        RETURN QUERY SELECT
            false,
            0,
            GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - NOW())))::INTEGER);
        RETURN;
    END IF;

    INSERT INTO public.rate_limit_hits(bucket, subject) VALUES (p_bucket, p_subject);

    RETURN QUERY SELECT true, GREATEST(0, p_limit - v_count - 1), 0;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- 17. EMAIL DELIVERY LOGS, SUPPRESSION & CRON TOKENS TABLES
-- ============================================================================
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
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 18. AUTOMATIC CHURCH MEMBER COUNT SYNC TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recompute_church_member_count(target_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF target_name IS NULL OR btrim(target_name) = '' THEN
        RETURN;
    END IF;
    UPDATE public.churches c
       SET members_count = (
             SELECT COUNT(*)::INTEGER
               FROM public.members m
              WHERE lower(btrim(m.church_name)) = lower(btrim(c.name))
           ),
           updated_at = NOW()
     WHERE lower(btrim(c.name)) = lower(btrim(target_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_church_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.recompute_church_member_count(NEW.church_name);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.recompute_church_member_count(OLD.church_name);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF COALESCE(OLD.church_name, '') IS DISTINCT FROM COALESCE(NEW.church_name, '') THEN
            PERFORM public.recompute_church_member_count(OLD.church_name);
        END IF;
        PERFORM public.recompute_church_member_count(NEW.church_name);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS members_sync_church_count ON public.members;
CREATE TRIGGER members_sync_church_count
AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_church_member_count();

-- ============================================================================
-- 19. ROW LEVEL SECURITY (RLS) HARDENING (SERVICE-ROLE GATEWAY ONLY)
-- ============================================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'churches', 'user_profiles', 'church_admin_accounts', 'leaders', 'members',
        'attendance_records', 'absence_records', 'cell_reports', 'service_types',
        'announcements', 'audit_logs', 'admin_settings', 'qr_tokens',
        'portal_sessions', 'login_otps', 'rate_limit_hits',
        'email_send_log', 'suppressed_emails', 'app_cron_tokens'
    ]) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- ============================================================================
-- 20. DEFAULT SERVICES & DEVELOPER PLATFORM SETTINGS SEED
-- ============================================================================
INSERT INTO public.service_types (name, description, default_day, default_time, is_global)
VALUES
    ('Sunday Service', 'Main Sunday Celebration & Word Service', 'Sunday', '08:00 AM', true),
    ('Midweek Service', 'Wednesday Teaching & Communion Service', 'Wednesday', '06:00 PM', true),
    ('Cell Ministry Meeting', 'Weekly Fellowship & Bible Study Cell', 'Saturday', '05:00 PM', true),
    ('Prayer Service', 'Corporate Friday All-Night / Intercessory Service', 'Friday', '06:00 PM', true),
    ('Special Service', 'Zonal Convention, Crusade, or Special Program', 'Sunday', '09:00 AM', true)
ON CONFLICT (name) DO NOTHING;

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
ON CONFLICT (setting_key) DO NOTHING;

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
`;
