CREATE OR REPLACE FUNCTION public.refresh_church_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.churches c SET members_count = (SELECT count(*) FROM public.members m WHERE m.church_id = c.id OR lower(m.church_name) = lower(c.name))
  WHERE c.id IN (COALESCE(NEW.church_id, OLD.church_id), COALESCE(OLD.church_id, NEW.church_id))
     OR lower(c.name) IN (lower(COALESCE(NEW.church_name,'')), lower(COALESCE(OLD.church_name,'')));
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_members_church_count ON public.members;
CREATE TRIGGER trg_members_church_count AFTER INSERT OR UPDATE OF church_id, church_name OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.refresh_church_member_count();
UPDATE public.churches c SET members_count = (SELECT count(*) FROM public.members m WHERE m.church_id = c.id OR lower(m.church_name) = lower(c.name));