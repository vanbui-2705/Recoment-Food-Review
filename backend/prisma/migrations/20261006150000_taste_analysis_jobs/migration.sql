CREATE TYPE "taste_analysis_status" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_REVIEW', 'APPLIED', 'FAILED', 'SUPERSEDED');
CREATE TABLE "taste_analysis_jobs" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "source_revision" INTEGER NOT NULL CHECK (source_revision > 0),
  "schema_version" INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  "status" "taste_analysis_status" NOT NULL DEFAULT 'QUEUED',
  "attempt" INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMPTZ(3),
  "lease_token" UUID,
  "result" JSONB,
  "model" VARCHAR(100),
  "error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "taste_analysis_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "taste_analysis_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "taste_analysis_jobs_user_id_source_revision_schema_version_key" ON "taste_analysis_jobs"("user_id", "source_revision", "schema_version");
CREATE INDEX "taste_analysis_jobs_status_available_at_lease_until_idx" ON "taste_analysis_jobs"("status", "available_at", "lease_until");
CREATE TABLE "ai_request_usage" (
  "day" VARCHAR(10) NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  CONSTRAINT "ai_request_usage_pkey" PRIMARY KEY ("day")
);
