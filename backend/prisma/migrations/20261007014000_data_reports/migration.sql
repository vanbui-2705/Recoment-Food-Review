CREATE TABLE data_reports (
 id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 target_kind VARCHAR(10) NOT NULL CHECK(target_kind IN ('OFFER','PLACE','RECIPE')),
 target_source VARCHAR(30), target_id VARCHAR(255) NOT NULL,
 reason VARCHAR(30) NOT NULL CHECK(reason IN ('WRONG_PRICE','UNAVAILABLE','WRONG_ADDRESS','INGREDIENTS','MEDIA','OTHER')),
 note VARCHAR(2000) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
 idempotency_key VARCHAR(255) NOT NULL UNIQUE, input_hash VARCHAR(64) NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX data_reports_user_id_created_at_id_idx ON data_reports(user_id, created_at DESC, id);
CREATE INDEX data_reports_status_created_at_id_idx ON data_reports(status, created_at, id);
CREATE INDEX data_reports_target_kind_target_id_idx ON data_reports(target_kind, target_id);
CREATE TABLE report_reviews (
 id UUID PRIMARY KEY, report_id UUID NOT NULL REFERENCES data_reports(id) ON DELETE CASCADE,
 actor_id UUID, from_status VARCHAR(12) NOT NULL, to_status VARCHAR(12) NOT NULL, reason VARCHAR(1000) NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX report_reviews_report_id_created_at_idx ON report_reviews(report_id, created_at);
