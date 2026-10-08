CREATE TABLE IF NOT EXISTS public.app_cron_tokens (token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.app_cron_tokens TO service_role;
ALTER TABLE public.app_cron_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access" ON public.app_cron_tokens FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);