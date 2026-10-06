CREATE TABLE account_deletion_jobs (
  id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), lease_token UUID, lease_until TIMESTAMPTZ(3), error_code VARCHAR(50),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CHECK ((status='RUNNING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR
    (status<>'RUNNING' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX account_deletion_jobs_status_available_at_lease_until_idx ON account_deletion_jobs(status,available_at,lease_until);
ALTER TABLE admin_audit ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE admin_audit ALTER COLUMN target_id DROP NOT NULL;
ALTER TABLE evidence_reviews ALTER COLUMN actor_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION guard_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anonymized_user TEXT;
BEGIN
  IF TG_OP='DELETE' AND OLD.created_at < CURRENT_TIMESTAMP - INTERVAL '365 days' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' THEN
    anonymized_user := current_setting('rec_food.anonymized_user', true);
    IF anonymized_user IS NOT NULL AND anonymized_user <> ''
      AND (to_jsonb(NEW)-'actor_id'-'target_id') = (to_jsonb(OLD)-'actor_id'-'target_id')
      AND (NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id OR (OLD.actor_id::text=anonymized_user AND NEW.actor_id IS NULL))
      AND (NEW.target_id IS NOT DISTINCT FROM OLD.target_id OR (OLD.target_id=anonymized_user AND NEW.target_id IS NULL))
    THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Admin audit is append-only';
END;
$$;
