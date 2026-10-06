-- Tighten the lease invariant without rewriting applied migration 30.
ALTER TABLE "menu_sync_jobs" ADD CONSTRAINT "menu_sync_jobs_lease_state_check" CHECK (
  ("status" = 'RUNNING' AND "lease_token" IS NOT NULL AND "lease_until" IS NOT NULL)
  OR ("status" <> 'RUNNING' AND "lease_token" IS NULL AND "lease_until" IS NULL)
) NOT VALID;
ALTER TABLE "menu_sync_jobs" VALIDATE CONSTRAINT "menu_sync_jobs_lease_state_check";
ALTER TABLE "menu_sync_jobs" DROP CONSTRAINT "menu_sync_jobs_check";
CREATE INDEX "menu_sync_jobs_schedule_id_status_idx" ON "menu_sync_jobs"("schedule_id","status");
