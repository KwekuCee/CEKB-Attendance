-- Sender ID ownership, approval history, admin alerts, and per-recipient SMS reporting.
-- All access is mediated by portal-db after validating its portal session.

CREATE TABLE IF NOT EXISTS public.sender_id_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_name TEXT,
    church_id UUID,
    church_name TEXT,
    sender_name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'verified', 'rejected', 'failed')),
    submission_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (submission_status IN ('pending', 'submitted', 'failed')),
    submission_response JSONB,
    submission_error TEXT,
    submitted_to_mnotify_at TIMESTAMPTZ,
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sender_id_requests_unique_active_name
    ON public.sender_id_requests (LOWER(sender_name))
    WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS sender_id_requests_owner_created
    ON public.sender_id_requests (LOWER(user_email), created_at DESC);
CREATE INDEX IF NOT EXISTS sender_id_requests_status_created
    ON public.sender_id_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sender_id_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id_request_id UUID NOT NULL REFERENCES public.sender_id_requests(id) ON DELETE CASCADE,
    changed_by TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id_request_id UUID REFERENCES public.sender_id_requests(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email')),
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    provider_campaign_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_alerts_status_created ON public.admin_alerts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_name TEXT,
    church_name TEXT,
    sender_id_request_id UUID NOT NULL REFERENCES public.sender_id_requests(id),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    pages_per_message INTEGER NOT NULL DEFAULT 1,
    total_pages INTEGER NOT NULL DEFAULT 0,
    unit_rate NUMERIC(12, 6) NOT NULL,
    estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
    actual_credits NUMERIC(12, 6),
    provider_campaign_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'partial', 'failed')),
    idempotency_key TEXT NOT NULL,
    last_polled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_campaigns_user_idempotency
    ON public.sms_campaigns (LOWER(user_email), idempotency_key);
CREATE INDEX IF NOT EXISTS sms_campaigns_owner_created
    ON public.sms_campaigns (LOWER(user_email), created_at DESC);
CREATE INDEX IF NOT EXISTS sms_campaigns_pending
    ON public.sms_campaigns (created_at) WHERE status IN ('sent', 'partial');

CREATE TABLE IF NOT EXISTS public.sms_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed')),
    failure_reason TEXT,
    provider_message_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, recipient_phone)
);
CREATE INDEX IF NOT EXISTS sms_recipients_campaign_status
    ON public.sms_recipients (campaign_id, status);

INSERT INTO public.admin_settings (setting_key, setting_value, setting_type, is_global)
VALUES (
    'mnotify_management',
    '{"adminPhone":"+233550160237","alertSenderId":"CEKBU DEV","unitRate":null,"lowBalanceThreshold":100}'::jsonb,
    'json',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

DO $$
DECLARE
    table_name TEXT;
    policy_row RECORD;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'sender_id_requests', 'sender_id_status_history', 'admin_alerts',
        'sms_campaigns', 'sms_recipients'
    ]
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
