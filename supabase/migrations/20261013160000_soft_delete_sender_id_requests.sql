ALTER TABLE public.sender_id_requests
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.sender_id_requests_unique_active_name;

CREATE UNIQUE INDEX sender_id_requests_unique_active_name
    ON public.sender_id_requests (LOWER(sender_name))
    WHERE status <> 'rejected' AND deleted_at IS NULL;
