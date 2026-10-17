-- Add is_test partition column to payment_transactions and update initial billing configuration
ALTER TABLE public.payment_transactions
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS pay_trans_is_test
    ON public.payment_transactions (is_test);

-- Update default settings JSON in admin_settings to include USD fee, fixed rate, and exemptChurches
UPDATE public.admin_settings
SET setting_value = jsonb_set(
    jsonb_set(
        jsonb_set(
            setting_value,
            '{monthlyFeeUsd}',
            '50'::jsonb,
            true
        ),
        '{exemptChurches}',
        COALESCE(setting_value->'exemptChurches', '[]'::jsonb),
        true
    ),
    '{monthlyFee}',
    '550'::jsonb,
    true
)
WHERE setting_key = 'billing';
