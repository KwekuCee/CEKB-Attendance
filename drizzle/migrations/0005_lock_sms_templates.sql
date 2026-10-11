ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_templates FROM anon, authenticated;
GRANT ALL ON public.sms_templates TO service_role;