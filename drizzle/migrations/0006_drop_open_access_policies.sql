DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_types','attendance_records','promotion_queue','church_admin_accounts','cell_reports','leaders','churches','announcements','members','audit_logs','admin_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated and anon access" ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;