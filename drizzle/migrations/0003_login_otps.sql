CREATE TABLE public.login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_otps TO service_role;
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access" ON public.login_otps FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX login_otps_email_idx ON public.login_otps (lower(email));