ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS start_time time, ADD COLUMN IF NOT EXISTS late_after_minutes integer NOT NULL DEFAULT 15;

CREATE OR REPLACE FUNCTION public.flag_late_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st time; grace int;
BEGIN
  SELECT start_time, late_after_minutes INTO st, grace FROM public.service_types
   WHERE lower(name) = lower(NEW.service_type) AND start_time IS NOT NULL LIMIT 1;
  IF st IS NOT NULL AND (COALESCE(NEW.checked_in_at, now()) AT TIME ZONE 'Africa/Accra')::time > st + make_interval(mins => grace) THEN
    NEW.status := 'Late';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_flag_late_attendance ON public.attendance_records;
CREATE TRIGGER trg_flag_late_attendance BEFORE INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.flag_late_attendance();