DO $$
DECLARE
    table_name TEXT;
    policy_row RECORD;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'members', 'leaders', 'attendance_records', 'absence_records', 'cell_reports', 'churches',
        'church_admin_accounts', 'user_profiles', 'audit_logs', 'announcements',
        'promotion_queue', 'qr_tokens', 'service_types', 'admin_settings',
        'portal_sessions', 'login_otps', 'password_reset_tokens', 'rate_limit_hits',
        'request_rate_limits', 'email_verification_tokens', 'church_report_codes',
        'email_send_log', 'email_send_state', 'email_unsubscribe_tokens',
        'suppressed_emails', 'app_cron_tokens', 'sms_templates'
    ]
    LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
            CONTINUE;
        END IF;

        FOR policy_row IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, table_name);
        END LOOP;

        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format(
            'CREATE POLICY "Server side access only" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
            table_name
        );
    END LOOP;
END $$;

DO $$
DECLARE
    function_row RECORD;
BEGIN
    FOR function_row IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'verify_user_login', 'confirm_leader_promotion', 'delete_church_cascade',
              'delete_leader_cascade', 'delete_member_cascade', 'consume_rate_limit',
              'apply_leader_growth_rules'
          )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_row.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_row.signature);
    END LOOP;
END $$;

DO $$
BEGIN
    IF to_regclass('public.audit_logs_id_seq') IS NOT NULL THEN
        REVOKE ALL ON SEQUENCE public.audit_logs_id_seq FROM PUBLIC, anon, authenticated;
        GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO service_role;
    END IF;
END $$;
