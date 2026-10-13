-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Enum types
DO $$ BEGIN CREATE TYPE user_role_enum AS ENUM ('Superadmin','Church Admin','Leader','Usher'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE leader_type_enum AS ENUM ('BSCT','Cell Leader','PCF Leader','Church Coordinator'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE promotion_status_enum AS ENUM ('None','Flagged','Confirmed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE member_status_enum AS ENUM ('First Timer','General Member','Alumni'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Churches (multi-tenancy root)
CREATE TABLE IF NOT EXISTS public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  pastor_name VARCHAR(255) NOT NULL DEFAULT 'Pastor in Charge',
  members_count INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Healthy',
  zone VARCHAR(100) NOT NULL DEFAULT 'Zone 1 (Korle Bu)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'Church Admin',
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  church_name VARCHAR(255),
  zone VARCHAR(100) DEFAULT 'Zone 1 (Korle Bu)',
  avatar_url TEXT,
  phone VARCHAR(50),
  is_church_admin BOOLEAN DEFAULT FALSE,
  admin_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leaders hierarchy tree
CREATE TABLE IF NOT EXISTS public.leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  church_name VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  contact VARCHAR(50),
  dob DATE,
  location VARCHAR(255),
  leader_type leader_type_enum NOT NULL DEFAULT 'BSCT',
  cell_or_pcf_name VARCHAR(255),
  parent_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
  is_appointed BOOLEAN DEFAULT FALSE,
  downstream_count INT NOT NULL DEFAULT 0,
  promotion_status promotion_status_enum NOT NULL DEFAULT 'None',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members directory
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
  service_count INT NOT NULL DEFAULT 1,
  foundation_class INT NOT NULL DEFAULT 0,
  status member_status_enum NOT NULL DEFAULT 'First Timer',
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Church admin accounts directory
CREATE TABLE IF NOT EXISTS public.church_admin_accounts (
  id VARCHAR(100) PRIMARY KEY,
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  church_name VARCHAR(255) NOT NULL,
  admin_name VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  admin_phone VARCHAR(50),
  password VARCHAR(255) DEFAULT 'CEKBU@2026',
  zone VARCHAR(100) DEFAULT 'Zone 1 (Korle Bu)',
  role VARCHAR(50) DEFAULT 'Church Admin',
  status VARCHAR(50) DEFAULT 'Active',
  joined_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_church_admin_email UNIQUE (admin_email)
);

-- Admin settings / preferences
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

-- QR passes
CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(50) REFERENCES public.members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service types
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

-- Attendance records
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
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Promotion queue
CREATE TABLE IF NOT EXISTS public.promotion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.leaders(id) ON DELETE CASCADE,
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  current_leader_role leader_type_enum NOT NULL,
  target_role leader_type_enum NOT NULL,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcements
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

-- Audit logs
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_church_id ON public.members(church_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_invited_by ON public.members(invited_by_leader_id);
CREATE INDEX IF NOT EXISTS idx_leaders_church_id ON public.leaders(church_id);
CREATE INDEX IF NOT EXISTS idx_leaders_parent_id ON public.leaders(parent_leader_id);
CREATE INDEX IF NOT EXISTS idx_attendance_church_id ON public.attendance_records(church_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_at ON public.attendance_records(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_member_id ON public.qr_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_service_types_church_id ON public.service_types(church_id);
CREATE INDEX IF NOT EXISTS idx_promotion_queue_leader_id ON public.promotion_queue(leader_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_churches_updated_at ON public.churches;
CREATE TRIGGER trg_churches_updated_at BEFORE UPDATE ON public.churches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_leaders_updated_at ON public.leaders;
CREATE TRIGGER trg_leaders_updated_at BEFORE UPDATE ON public.leaders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_service_types_updated_at ON public.service_types;
CREATE TRIGGER trg_service_types_updated_at BEFORE UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER trg_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leader promotion auto-flagging
CREATE OR REPLACE FUNCTION public.trigger_leader_promotion_check()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.downstream_count >= 5 AND NEW.leader_type = 'BSCT' AND NEW.promotion_status = 'None' THEN
    NEW.promotion_status = 'Flagged';
    INSERT INTO public.promotion_queue (leader_id, church_id, current_leader_role, target_role, reason)
    VALUES (NEW.id, NEW.church_id, 'BSCT', 'Cell Leader',
      'Auto-flagged: Downstream network reached ' || NEW.downstream_count || ' active soul-winning disciples.');
  ELSIF NEW.downstream_count >= 15 AND NEW.leader_type = 'Cell Leader' AND NEW.promotion_status = 'None' THEN
    NEW.promotion_status = 'Flagged';
    INSERT INTO public.promotion_queue (leader_id, church_id, current_leader_role, target_role, reason)
    VALUES (NEW.id, NEW.church_id, 'Cell Leader', 'PCF Leader',
      'Auto-flagged: Cell network reached ' || NEW.downstream_count || ' members across multiple cells.');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_leader_promotion_check ON public.leaders;
CREATE TRIGGER trg_leader_promotion_check BEFORE INSERT OR UPDATE OF downstream_count ON public.leaders
FOR EACH ROW EXECUTE FUNCTION public.trigger_leader_promotion_check();

-- Attendance check-in side effects
CREATE OR REPLACE FUNCTION public.trigger_attendance_check_in_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.members
  SET service_count = service_count + 1,
      status = CASE WHEN status = 'First Timer' AND service_count + 1 >= 2 THEN 'General Member'::member_status_enum ELSE status END
  WHERE id = NEW.member_id;

  INSERT INTO public.audit_logs (actor, church_id, church_name, action, category, icon)
  VALUES (COALESCE(NEW.verified_by, 'System'), NEW.church_id, NEW.church_name,
    'Verified attendance check-in for ' || NEW.member_name || ' (' || COALESCE(NEW.member_id, 'n/a') || ')', 'Check-in', 'qr_code');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_attendance_check_in ON public.attendance_records;
CREATE TRIGGER trg_attendance_check_in AFTER INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.trigger_attendance_check_in_update();

-- Cascading delete helpers
CREATE OR REPLACE FUNCTION public.delete_member_cascade(p_member_id VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name VARCHAR(255); v_church UUID;
BEGIN
  SELECT full_name, church_id INTO v_name, v_church FROM public.members WHERE id = p_member_id;
  IF v_name IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM public.qr_tokens WHERE member_id = p_member_id;
  DELETE FROM public.attendance_records WHERE member_id = p_member_id;
  DELETE FROM public.members WHERE id = p_member_id;
  INSERT INTO public.audit_logs (actor, church_id, action, category, icon)
  VALUES ('Admin/System', v_church, 'Deleted member record: ' || v_name || ' (' || p_member_id || ')', 'Member', 'delete_forever');
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_leader_cascade(p_leader_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name VARCHAR(255); v_church UUID; v_parent UUID;
BEGIN
  SELECT full_name, church_id, parent_leader_id INTO v_name, v_church, v_parent FROM public.leaders WHERE id = p_leader_id;
  IF v_name IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.leaders SET parent_leader_id = v_parent WHERE parent_leader_id = p_leader_id;
  UPDATE public.members SET invited_by_leader_id = v_parent WHERE invited_by_leader_id = p_leader_id;
  DELETE FROM public.promotion_queue WHERE leader_id = p_leader_id;
  DELETE FROM public.leaders WHERE id = p_leader_id;
  INSERT INTO public.audit_logs (actor, church_id, action, category, icon)
  VALUES ('Admin/System', v_church, 'Deleted leader: ' || v_name || ' and reassigned downstream structure.', 'Leader', 'person_remove');
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_church_cascade(p_church_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name VARCHAR(255);
BEGIN
  SELECT name INTO v_name FROM public.churches WHERE id = p_church_id;
  IF v_name IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM public.attendance_records WHERE church_id = p_church_id;
  DELETE FROM public.members WHERE church_id = p_church_id;
  DELETE FROM public.leaders WHERE church_id = p_church_id;
  DELETE FROM public.churches WHERE id = p_church_id;
  INSERT INTO public.audit_logs (actor, action, category, icon)
  VALUES ('Group Pastor', 'Deleted church branch: ' || v_name || ' and related branch records.', 'System', 'domain_disabled');
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_leader_promotion(p_promotion_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_leader UUID; v_target leader_type_enum; v_name VARCHAR(255); v_church UUID;
BEGIN
  SELECT leader_id, target_role, church_id INTO v_leader, v_target, v_church FROM public.promotion_queue WHERE id = p_promotion_id;
  IF v_leader IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.leaders SET leader_type = v_target, promotion_status = 'Confirmed' WHERE id = v_leader RETURNING full_name INTO v_name;
  DELETE FROM public.promotion_queue WHERE id = p_promotion_id;
  INSERT INTO public.audit_logs (actor, church_id, action, category, icon)
  VALUES ('Group Pastor', v_church, 'Confirmed promotion for ' || COALESCE(v_name,'leader') || ' to ' || v_target, 'Leader', 'verified');
  RETURN TRUE;
END; $$;

-- Login verification used by the admin portal
CREATE OR REPLACE FUNCTION public.verify_user_login(
  p_identifier TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT NULL,
  p_church_name TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user RECORD;
BEGIN
  SELECT id, username, email, password_hash, full_name, role::text AS role, church_name, zone, phone
  INTO v_user FROM public.user_profiles
  WHERE LOWER(email) = LOWER(TRIM(p_identifier)) OR LOWER(username) = LOWER(TRIM(p_identifier))
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT gen_random_uuid() AS id, admin_email AS username, admin_email AS email,
           COALESCE(password, 'CEKBU@2026') AS password_hash, admin_name AS full_name,
           'Church Admin'::text AS role, church_name, zone, admin_phone AS phone
    INTO v_user FROM public.church_admin_accounts
    WHERE LOWER(admin_email) = LOWER(TRIM(p_identifier)) OR LOWER(admin_name) = LOWER(TRIM(p_identifier))
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Account not found in the database. Please verify your email or username.');
    END IF;
  END IF;

  IF p_role = 'Superadmin' AND v_user.role <> 'Superadmin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access Denied: This account is not provisioned with Superadmin (Group Pastor) privileges.');
  END IF;

  IF v_user.password_hash <> p_password
     AND (v_user.password_hash NOT LIKE '$2%' OR v_user.password_hash <> extensions.crypt(p_password, v_user.password_hash)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect password entered. Please check your credentials.');
  END IF;

  RETURN jsonb_build_object('success', true, 'user', jsonb_build_object(
    'id', v_user.id,
    'name', v_user.full_name,
    'email', v_user.email,
    'phone', v_user.phone,
    'role', v_user.role,
    'church', COALESCE(v_user.church_name, CASE WHEN v_user.role = 'Superadmin' THEN 'GCYC Group HQ' ELSE 'GCYC 1' END),
    'zone', COALESCE(v_user.zone, 'Zone 1 (Korle Bu)')
  ));
END; $$;

-- Row level security, grants and portal policies
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['churches','user_profiles','leaders','members','church_admin_accounts','admin_settings','qr_tokens','service_types','attendance_records','promotion_queue','announcements','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Portal access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Portal access %s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_user_login(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_member_cascade(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_leader_cascade(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_church_cascade(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_leader_promotion(UUID) TO anon, authenticated, service_role;

-- Seed data
INSERT INTO public.churches (id, name, pastor_name, members_count, status, zone) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001','GCYC 1','Pastor Emmanuel',280,'Healthy','Zone 1 (Korle Bu)'),
  ('a1b2c3d4-0000-0000-0000-000000000002','GCYC 2','Pastor Michael',195,'Healthy','Zone 1 (Korle Bu)'),
  ('a1b2c3d4-0000-0000-0000-000000000003','GCYC 3','Pastor Sarah',220,'Healthy','Zone 1 (Korle Bu)'),
  ('a1b2c3d4-0000-0000-0000-000000000004','GCYC 4','Pastor David',160,'Attention Needed','Zone 1 (Korle Bu)'),
  ('a1b2c3d4-0000-0000-0000-000000000005','GCYC 5','Pastor Grace',140,'Healthy','Zone 1 (Korle Bu)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.user_profiles (username, email, password_hash, full_name, role, church_id, church_name, zone, avatar_url) VALUES
  ('admin.korlebu1','admin.korlebu1@cekorlebu.org', extensions.crypt('CEKBU@2026', extensions.gen_salt('bf')),'Brother Michael (Admin)','Church Admin','a1b2c3d4-0000-0000-0000-000000000001','GCYC 1','Zone 1 (Korle Bu)','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'),
  ('admin.korlebu2','admin.korlebu2@cekorlebu.org', extensions.crypt('CEKBU@2026', extensions.gen_salt('bf')),'Sister Debra (Admin)','Church Admin','a1b2c3d4-0000-0000-0000-000000000002','GCYC 2','Zone 1 (Korle Bu)','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.church_admin_accounts (id, church_id, church_name, admin_name, admin_email, admin_phone, zone, role) VALUES
  ('ADM-101','a1b2c3d4-0000-0000-0000-000000000001','GCYC 1','Brother Michael','admin.korlebu1@cekorlebu.org','+233 24 111 2222','Zone 1 (Korle Bu)','Church Admin'),
  ('ADM-102','a1b2c3d4-0000-0000-0000-000000000002','GCYC 2','Sister Debra','admin.korlebu2@cekorlebu.org','+233 24 333 4444','Zone 1 (Korle Bu)','Church Admin'),
  ('ADM-103','a1b2c3d4-0000-0000-0000-000000000003','GCYC 3','Brother Daniel','admin.korlebu3@cekorlebu.org','+233 24 555 6666','Zone 1 (Korle Bu)','Church Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_types (name, description, is_global, is_active) VALUES
  ('Sunday Service','Main Sunday Worship & Communion Service',TRUE,TRUE),
  ('Midweek Service','Wednesday Teaching & Bible Study Service',TRUE,TRUE),
  ('Special Service','Praise Night, All-Night Vigils, and Special Programs',TRUE,TRUE)
ON CONFLICT (name) DO NOTHING;