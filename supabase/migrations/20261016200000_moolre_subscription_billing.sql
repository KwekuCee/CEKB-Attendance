-- Moolre Monthly Subscription Payments & Transactions Schema
-- Tables are locked to the service role; all access is mediated by portal-db and moolre-payments.

CREATE TABLE IF NOT EXISTS public.church_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID,
    church_name TEXT NOT NULL,
    period TEXT NOT NULL, -- Format: YYYY-MM (e.g. '2026-11')
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed')),
    paid_at TIMESTAMPTZ,
    payment_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (church_name, period)
);

CREATE INDEX IF NOT EXISTS church_subs_name_period
    ON public.church_subscriptions (LOWER(church_name), period);
CREATE INDEX IF NOT EXISTS church_subs_status
    ON public.church_subscriptions (status);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID,
    church_name TEXT NOT NULL,
    period TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    moolre_reference TEXT,
    external_ref TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL, -- e.g. 'MTN', 'Telecel', 'AirtelTigo'
    masked_phone TEXT NOT NULL, -- e.g. '•••• •• 1234'
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed')),
    payer_email TEXT,
    raw_response JSONB,
    session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pay_trans_church
    ON public.payment_transactions (LOWER(church_name), created_at DESC);
CREATE INDEX IF NOT EXISTS pay_trans_external_ref
    ON public.payment_transactions (external_ref);
CREATE INDEX IF NOT EXISTS pay_trans_status
    ON public.payment_transactions (status);

-- Seed initial billing settings in admin_settings
INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'billing',
    '{"enabled": false, "monthlyFee": 150, "graceDays": 5, "testMode": true}'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

-- Enforce service-role only access on the new tables
DO $$
DECLARE
    table_name TEXT;
    policy_row RECORD;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['church_subscriptions', 'payment_transactions']
    LOOP
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
