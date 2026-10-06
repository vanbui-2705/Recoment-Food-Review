CREATE TABLE ai_budget_usage (
  namespace varchar(64) NOT NULL,
  day varchar(10) NOT NULL,
  reserved_micros bigint NOT NULL DEFAULT 0 CHECK(reserved_micros>=0),
  requests integer NOT NULL DEFAULT 0 CHECK(requests>=0),
  PRIMARY KEY(namespace, day)
);
