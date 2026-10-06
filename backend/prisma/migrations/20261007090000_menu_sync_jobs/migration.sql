CREATE TABLE "menu_sync_schedules" (
  "supplier_id" UUID PRIMARY KEY REFERENCES "merchant_suppliers"("id") ON DELETE RESTRICT,
  "adapter_code" VARCHAR(50) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "interval_minutes" INTEGER NOT NULL CHECK ("interval_minutes" BETWEEN 5 AND 1440),
  "next_run_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "menu_sync_schedules_enabled_next_run_at_idx" ON "menu_sync_schedules"("enabled","next_run_at");
CREATE TABLE "menu_sync_jobs" (
  "id" UUID PRIMARY KEY,
  "schedule_id" UUID NOT NULL REFERENCES "menu_sync_schedules"("supplier_id") ON DELETE RESTRICT,
  "idempotency_key" VARCHAR(255) NOT NULL UNIQUE,
  "status" VARCHAR(12) NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMPTZ(3),
  "lease_token" UUID,
  "manifest" JSONB,
  "run_id" UUID REFERENCES "menu_sync_runs"("id") ON DELETE SET NULL,
  "error_code" VARCHAR(50),
  "retryable" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("status" = 'RUNNING') = ("lease_token" IS NOT NULL AND "lease_until" IS NOT NULL))
);
CREATE INDEX "menu_sync_jobs_status_available_at_lease_until_idx" ON "menu_sync_jobs"("status","available_at","lease_until");
CREATE INDEX "menu_sync_jobs_created_at_id_idx" ON "menu_sync_jobs"("created_at","id");
