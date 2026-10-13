CREATE OR REPLACE FUNCTION public.handle_church_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.attendance_records
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.absence_records
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.cell_reports
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.church_report_codes
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.promotion_queue
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.announcements WHERE church_id = OLD.id;
    UPDATE public.audit_logs SET church_id = NULL WHERE church_id = OLD.id;

    UPDATE public.members
    SET invited_by_leader_id = NULL
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    UPDATE public.leaders
    SET parent_leader_id = NULL
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.qr_tokens
    WHERE member_id IN (
        SELECT id FROM public.members
        WHERE church_id = OLD.id OR church_name ILIKE OLD.name
    );

    DELETE FROM public.members
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.leaders
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.church_admin_accounts
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    DELETE FROM public.user_profiles
    WHERE (church_id = OLD.id OR church_name ILIKE OLD.name)
      AND role NOT IN ('Superadmin', 'Developer');

    DELETE FROM public.service_types
    WHERE is_global = FALSE AND church_id = OLD.id;

    DELETE FROM public.portal_sessions
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
