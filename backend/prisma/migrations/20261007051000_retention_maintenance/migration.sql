CREATE TABLE maintenance_leases (
 name VARCHAR(80) PRIMARY KEY, lease_token UUID, lease_until TIMESTAMPTZ(3),
 next_run_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), last_completed_at TIMESTAMPTZ(3), last_error_code VARCHAR(50),
 CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX user_interactions_retention_idx ON user_interactions(created_at,id);
CREATE INDEX recipe_interactions_retention_idx ON recipe_interactions(created_at,id);
CREATE INDEX recommendation_requests_retention_idx ON recommendation_requests(requested_at,id);
CREATE INDEX conversations_retention_idx ON conversations(updated_at,id);
CREATE INDEX taste_analysis_jobs_retention_idx ON taste_analysis_jobs(created_at,id);
