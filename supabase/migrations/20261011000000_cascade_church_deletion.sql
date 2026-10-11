-- ============================================================================
-- Migration: Complete Cascade Deletion for Church Branches
-- Ensures when a church is deleted, ALL its associated members, leaders,
-- check-ins, cell reports, absence logs, and staff accounts are permanently deleted.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_church_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Delete all check-in attendance records
    DELETE FROM public.attendance_records
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 2. Delete all absence follow-up records
    DELETE FROM public.absence_records
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 3. Delete all weekly cell reports
    DELETE FROM public.cell_reports
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 4. Delete church cell report access codes
    DELETE FROM public.church_report_codes
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 5. Delete promotion queue requests
    DELETE FROM public.promotion_queue
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 6. Delete announcements for this church
    DELETE FROM public.announcements
    WHERE church_id = OLD.id;

    -- 7. Nullify church_id in audit logs to preserve audit trail without FK violation
    UPDATE public.audit_logs
    SET church_id = NULL
    WHERE church_id = OLD.id;

    -- 8. Clear circular foreign keys before deleting members and leaders
    UPDATE public.members
    SET invited_by_leader_id = NULL
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    UPDATE public.leaders
    SET parent_leader_id = NULL
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 9. Delete QR passes for members belonging to this church
    DELETE FROM public.qr_tokens
    WHERE member_id IN (
        SELECT id FROM public.members
        WHERE church_id = OLD.id OR church_name ILIKE OLD.name
    );

    -- 10. Delete all members belonging to this church
    DELETE FROM public.members
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 11. Delete all leaders belonging to this church
    DELETE FROM public.leaders
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 12. Delete branch admin accounts directory rows
    DELETE FROM public.church_admin_accounts
    WHERE church_id = OLD.id OR church_name ILIKE OLD.name;

    -- 13. Delete user profiles belonging to this church (excluding Superadmin and Developer)
    DELETE FROM public.user_profiles
    WHERE (church_id = OLD.id OR church_name ILIKE OLD.name)
      AND role NOT IN ('Superadmin', 'Developer');

    -- 14. Delete non-global service types tied specifically to this church
    DELETE FROM public.service_types
    WHERE is_global = FALSE AND (church_id = OLD.id OR church_name ILIKE OLD.name);

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_church_deletion_safety ON public.churches;
CREATE TRIGGER trg_church_deletion_safety
BEFORE DELETE ON public.churches
FOR EACH ROW EXECUTE FUNCTION public.handle_church_deletion_safety();
