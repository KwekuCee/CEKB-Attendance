-- ============================================================================
-- Migration: Evangelism & Soulwinning Records Table, Constraints, and Policies
-- Safe to execute on existing Supabase instances.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evangelism_records (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  phone text NOT NULL,
  gender text,
  location text,
  date_won text NOT NULL,
  leader_id text,
  leader_name text NOT NULL,
  cell_or_pcf_name text,
  church text NOT NULL,
  church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE,
  notes text,
  status text NOT NULL DEFAULT 'Soul Won',
  member_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_evangelism_records_church ON public.evangelism_records(church);
CREATE INDEX IF NOT EXISTS idx_evangelism_records_leader_id ON public.evangelism_records(leader_id);
CREATE INDEX IF NOT EXISTS idx_evangelism_records_status ON public.evangelism_records(status);
CREATE INDEX IF NOT EXISTS idx_evangelism_records_date_won ON public.evangelism_records(date_won);

-- Row-Level Security
ALTER TABLE public.evangelism_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evangelism_records' AND policyname = 'Allow anon and auth read on evangelism_records'
  ) THEN
    CREATE POLICY "Allow anon and auth read on evangelism_records"
      ON public.evangelism_records FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evangelism_records' AND policyname = 'Allow anon and auth insert on evangelism_records'
  ) THEN
    CREATE POLICY "Allow anon and auth insert on evangelism_records"
      ON public.evangelism_records FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evangelism_records' AND policyname = 'Allow anon and auth update on evangelism_records'
  ) THEN
    CREATE POLICY "Allow anon and auth update on evangelism_records"
      ON public.evangelism_records FOR UPDATE
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evangelism_records' AND policyname = 'Allow anon and auth delete on evangelism_records'
  ) THEN
    CREATE POLICY "Allow anon and auth delete on evangelism_records"
      ON public.evangelism_records FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
