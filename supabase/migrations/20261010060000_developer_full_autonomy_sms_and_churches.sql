-- ============================================================================
-- Migration: Developer Full Autonomy, Churches CRUD Cascades, SMS Gateway & Templates
-- Safe to run on your existing Supabase database (idempotent)
-- ============================================================================

-- 1. Ensure churches deletion safely unbinds associated records
CREATE OR REPLACE FUNCTION public.handle_church_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.members SET church_name = NULL, church_id = NULL WHERE church_id = OLD.id OR church_name = OLD.name;
    UPDATE public.leaders SET church_name = NULL, church_id = NULL WHERE church_id = OLD.id OR church_name = OLD.name;
    UPDATE public.user_profiles SET church_name = NULL, church_id = NULL WHERE church_id = OLD.id OR church_name = OLD.name;
    UPDATE public.church_admin_accounts SET church_name = 'Unassigned', church_id = NULL WHERE church_id = OLD.id OR church_name = OLD.name;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_church_deletion_safety ON public.churches;
CREATE TRIGGER trg_church_deletion_safety
BEFORE DELETE ON public.churches
FOR EACH ROW EXECUTE FUNCTION public.handle_church_deletion_safety();

-- 2. SMS Templates Table
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    content TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '["{name}", "{church}"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_category ON public.sms_templates(category);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON public.sms_templates(is_active);

-- Seed Default SMS Templates
INSERT INTO public.sms_templates (name, title, category, content, variables, is_active)
VALUES
    ('welcome_verification', 'Welcome & Activation SMS', 'Onboarding', 'Welcome to CEKB! Your account has been approved. Use code {code} or login at {link}', '["{name}", "{code}", "{link}"]'::jsonb, true),
    ('checkin_confirmation', 'Check-in Confirmation', 'Attendance', 'Dear {name}, thank you for worshipping with us at {church} today! Grace be multiplied to you.', '["{name}", "{church}"]'::jsonb, true),
    ('absence_followup', 'Absentee Follow-up SMS', 'Pastoral', 'Dear {name}, we missed your fellowship today at {church}! We are praying with you this week.', '["{name}", "{church}"]'::jsonb, true),
    ('cell_meeting_reminder', 'Cell Meeting Reminder', 'Fellowship', 'Hi {name}, our Cell fellowship meets this week. Come expectant for a supernatural time!', '["{name}", "{church}", "{time}"]'::jsonb, true),
    ('birthday_blessings', 'Birthday Blessings SMS', 'Celebration', 'Happy Birthday {name}! CEKB family rejoices with you today. Walk in supernatural abundance!', '["{name}", "{church}"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- 3. Ensure email_send_log supports SMS telemetry & Channel tagging
ALTER TABLE public.email_send_log
    ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'email',
    ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS body_preview TEXT;

CREATE INDEX IF NOT EXISTS idx_email_send_log_channel ON public.email_send_log(channel);

-- 4. Seed default SMS Gateway configuration into admin_settings
INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'sms_config',
    '{
        "provider": "Hubtel",
        "senderId": "CE KORLE BU",
        "apiKey": "",
        "apiSecret": "",
        "enabled": false,
        "autoSendRegistration": false,
        "autoSendCheckin": false,
        "defaultCountryCode": "+233",
        "lowCreditThreshold": 50
    }'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Seed default SMS Templates list in admin_settings for instant fallback
INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'sms_templates',
    '[
        {"id": "tpl-1", "name": "welcome_verification", "title": "Welcome & Activation SMS", "category": "Onboarding", "content": "Welcome to CEKB! Your account has been approved. Use code {code} or login at {link}", "variables": ["{name}", "{code}", "{link}"], "is_active": true},
        {"id": "tpl-2", "name": "checkin_confirmation", "title": "Check-in Confirmation", "category": "Attendance", "content": "Dear {name}, thank you for worshipping with us at {church} today! Grace be multiplied to you.", "variables": ["{name}", "{church}"], "is_active": true},
        {"id": "tpl-3", "name": "absence_followup", "title": "Absentee Follow-up SMS", "category": "Pastoral", "content": "Dear {name}, we missed your fellowship today at {church}! We are praying with you this week.", "variables": ["{name}", "{church}"], "is_active": true},
        {"id": "tpl-4", "name": "cell_meeting_reminder", "title": "Cell Meeting Reminder", "category": "Fellowship", "content": "Hi {name}, our Cell fellowship meets this week. Come expectant for a supernatural time!", "variables": ["{name}", "{church}", "{time}"], "is_active": true},
        {"id": "tpl-5", "name": "birthday_blessings", "title": "Birthday Blessings SMS", "category": "Celebration", "content": "Happy Birthday {name}! CEKB family rejoices with you today. Walk in supernatural abundance!", "variables": ["{name}", "{church}"], "is_active": true}
    ]'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

-- 6. Add indexes on user_profiles for instant unverified registrations querying
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin_verified ON public.user_profiles(admin_verified);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_verified ON public.user_profiles(role, admin_verified);
