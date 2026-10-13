-- Migration: leader_cell_attendance_and_indexes
-- Description: Optimizes attendance queries per date/service for Cell and PCF leaders,
-- ensures indexes on invited_by_leader_id, and hardens table constraints.

-- 1. Index attendance records by date and service type for instant per-date rollups
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_service 
ON public.attendance_records (attendance_date, service_type);

CREATE INDEX IF NOT EXISTS idx_attendance_records_church_date 
ON public.attendance_records (church_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_records_leader_name 
ON public.attendance_records (leader_name);

CREATE INDEX IF NOT EXISTS idx_attendance_records_pcf_name 
ON public.attendance_records (pcf_name);

CREATE INDEX IF NOT EXISTS idx_attendance_records_member_id 
ON public.attendance_records (member_id);

-- 2. Index members by inviting leader to accelerate cell & PCF membership views
CREATE INDEX IF NOT EXISTS idx_members_invited_by_leader_id 
ON public.members (invited_by_leader_id);

CREATE INDEX IF NOT EXISTS idx_members_invited_by_name 
ON public.members (invited_by_name);

CREATE INDEX IF NOT EXISTS idx_members_church_invited_leader 
ON public.members (church_id, invited_by_leader_id);

-- 3. Ensure leader and pcf columns exist with proper column defaults in attendance_records
ALTER TABLE public.attendance_records 
    ADD COLUMN IF NOT EXISTS leader_name VARCHAR(255) DEFAULT 'Direct / Self',
    ADD COLUMN IF NOT EXISTS pcf_name VARCHAR(255) DEFAULT 'General PCF',
    ADD COLUMN IF NOT EXISTS attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Ensure member linkage columns exist in members
ALTER TABLE public.members 
    ADD COLUMN IF NOT EXISTS invited_by_leader_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS invited_by_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pcf_leader TEXT,
    ADD COLUMN IF NOT EXISTS cell_leader TEXT;

-- 5. Harden service_role access policy for attendance and members
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'attendance_records' 
          AND policyname = 'Server side access only'
    ) THEN
        CREATE POLICY "Server side access only" 
        ON public.attendance_records 
        FOR ALL TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'members' 
          AND policyname = 'Server side access only'
    ) THEN
        CREATE POLICY "Server side access only" 
        ON public.members 
        FOR ALL TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
