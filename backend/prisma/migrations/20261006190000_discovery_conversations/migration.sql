CREATE TABLE conversations (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(100) NOT NULL, context JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX conversations_user_id_updated_at_id_idx ON conversations(user_id, updated_at DESC, id);
CREATE TABLE chat_messages (
 id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role VARCHAR(10) NOT NULL CHECK(role IN ('USER','ASSISTANT')), content VARCHAR(4000) NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX chat_messages_conversation_id_created_at_id_idx ON chat_messages(conversation_id, created_at, id);
CREATE TABLE chat_runs (
 id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 message_id UUID NOT NULL UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
 idempotency_key VARCHAR(255) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL,
 context JSONB NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'QUEUED', attempts INTEGER NOT NULL DEFAULT 0,
 lease_token UUID, lease_until TIMESTAMPTZ(3), next_seq INTEGER NOT NULL DEFAULT 0,
 error_code VARCHAR(50), created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL,
 CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')),
 CHECK(attempts BETWEEN 0 AND 5 AND next_seq BETWEEN 0 AND 100),
 CHECK((status='RUNNING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (status<>'RUNNING' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX chat_runs_status_lease_until_created_at_idx ON chat_runs(status, lease_until, created_at);
CREATE INDEX chat_runs_conversation_id_created_at_idx ON chat_runs(conversation_id, created_at);
CREATE UNIQUE INDEX chat_runs_one_active_per_conversation ON chat_runs(conversation_id) WHERE status IN ('QUEUED','RUNNING');
CREATE TABLE chat_events (
 id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES chat_runs(id) ON DELETE CASCADE,
 seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 100), type VARCHAR(20) NOT NULL,
 payload JSONB NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(run_id, seq)
);
