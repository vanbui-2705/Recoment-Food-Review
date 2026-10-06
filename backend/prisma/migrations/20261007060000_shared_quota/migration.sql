CREATE TABLE shared_quota_buckets (
  key varchar(64) PRIMARY KEY,
  namespace varchar(64) NOT NULL,
  scope varchar(80) NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  reset_at timestamptz(3) NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX shared_quota_buckets_expiry_idx ON shared_quota_buckets(reset_at);
CREATE INDEX shared_quota_buckets_scope_idx ON shared_quota_buckets(namespace, scope, reset_at);
CREATE TABLE provider_observations (
  namespace varchar(64) NOT NULL,
  provider varchar(20) NOT NULL,
  last_attempt_at timestamptz(3) NOT NULL,
  last_success_at timestamptz(3),
  last_status varchar(20) NOT NULL CHECK (last_status IN ('OK','UNAVAILABLE','QUOTA_EXCEEDED')),
  requests bigint NOT NULL DEFAULT 0 CHECK(requests >= 0),
  failures bigint NOT NULL DEFAULT 0 CHECK(failures >= 0),
  quota_rejections bigint NOT NULL DEFAULT 0 CHECK(quota_rejections >= 0),
  PRIMARY KEY(namespace, provider)
);
