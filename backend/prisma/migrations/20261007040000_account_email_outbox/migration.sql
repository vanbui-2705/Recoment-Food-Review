CREATE TABLE email_action_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(10) NOT NULL CHECK (purpose IN ('RESET', 'VERIFY')),
  token_hash VARCHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  auth_version INTEGER NOT NULL CHECK (auth_version >= 0),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  consumed_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '1 day')
);
CREATE INDEX email_action_tokens_user_id_purpose_created_at_idx ON email_action_tokens(user_id, purpose, created_at);
CREATE INDEX email_action_tokens_expires_at_idx ON email_action_tokens(expires_at);
CREATE TABLE email_outbox (
  id UUID PRIMARY KEY,
  token_id UUID NOT NULL UNIQUE REFERENCES email_action_tokens(id) ON DELETE CASCADE,
  encrypted_body TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','SENT','FAILED','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  lease_token UUID,
  lease_until TIMESTAMPTZ(3),
  provider_message_id VARCHAR(100),
  error_code VARCHAR(50),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CHECK ((status = 'PROCESSING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR
    (status <> 'PROCESSING' AND lease_token IS NULL AND lease_until IS NULL)),
  CHECK ((status IN ('QUEUED','PROCESSING') AND encrypted_body IS NOT NULL) OR
    (status IN ('SENT','FAILED','CANCELLED') AND encrypted_body IS NULL))
);
CREATE INDEX email_outbox_status_available_at_lease_until_idx ON email_outbox(status, available_at, lease_until);
