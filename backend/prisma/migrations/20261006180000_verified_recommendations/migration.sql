-- AlterTable
ALTER TABLE "recommendation_requests" ADD COLUMN     "idempotency_key" VARCHAR(255),
ADD COLUMN     "input_hash" VARCHAR(64),
ADD COLUMN     "lease_token" UUID,
ADD COLUMN     "lease_until" TIMESTAMPTZ(3),
ADD COLUMN     "outcome_code" VARCHAR(80),
ADD COLUMN     "processing_state" VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "profile_revision" INTEGER,
ADD COLUMN     "ranking_status" VARCHAR(80) NOT NULL DEFAULT 'DETERMINISTIC';

-- AlterTable
ALTER TABLE "recommendation_results" ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "offer_id" UUID,
ADD COLUMN     "price" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_requests_idempotency_key_key" ON "recommendation_requests"("idempotency_key");

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "external_menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
