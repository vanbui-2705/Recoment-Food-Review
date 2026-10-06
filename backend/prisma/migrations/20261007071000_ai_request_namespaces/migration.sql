CREATE TABLE ai_request_counters (
  namespace varchar(64) NOT NULL,
  day varchar(10) NOT NULL,
  requests integer NOT NULL DEFAULT 0 CHECK(requests>=0),
  PRIMARY KEY(namespace,day)
);
-- Preserve existing consumption in the default deployment; do not reset today's quota.
INSERT INTO ai_request_counters(namespace,day,requests)
SELECT 'rec-food',day,requests FROM ai_request_usage;
-- Keep the original table intact for compatible older images during a controlled rollback.
