-- CreateEnum
CREATE TYPE "MenuSyncMode" AS ENUM ('COMPLETE', 'DELTA');

-- CreateEnum
CREATE TYPE "MenuSyncStatus" AS ENUM ('STAGING', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfferMappingStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "SafetyEvidenceKind" AS ENUM ('ALLERGEN', 'DIET', 'CROSS_CONTACT');

-- CreateEnum
CREATE TYPE "SafetyEvidenceClaim" AS ENUM ('PRESENT', 'ABSENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SafetyEvidenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REVOKED');

-- DropIndex
DROP INDEX "user_interactions_cooldown_idx";

-- CreateTable
CREATE TABLE "merchant_suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "documentation_url" VARCHAR(2000) NOT NULL,
    "authorization_reference" VARCHAR(500) NOT NULL,
    "max_evidence_age_hours" INTEGER NOT NULL DEFAULT 24,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_committed_at" TIMESTAMPTZ(3),

    CONSTRAINT "merchant_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_restaurant_identities" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "restaurant_id" UUID NOT NULL,

    CONSTRAINT "external_restaurant_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_menu_items" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "option_label" VARCHAR(200),
    "price" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source_url" VARCHAR(2000) NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "dish_id" UUID,
    "mapping_status" "OfferMappingStatus" NOT NULL DEFAULT 'PENDING',
    "last_sync_run_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "external_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_sync_runs" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "snapshot_id" VARCHAR(255) NOT NULL,
    "mode" "MenuSyncMode" NOT NULL,
    "status" "MenuSyncStatus" NOT NULL DEFAULT 'STAGING',
    "expected_pages" INTEGER NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ(3),
    "error_code" VARCHAR(80),

    CONSTRAINT "menu_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_sync_pages" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "page" INTEGER NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "menu_sync_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_quarantine" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "page" INTEGER NOT NULL,
    "row_index" INTEGER NOT NULL,
    "code" VARCHAR(80) NOT NULL,

    CONSTRAINT "menu_quarantine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_safety_evidence" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "kind" "SafetyEvidenceKind" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "claim" "SafetyEvidenceClaim" NOT NULL,
    "status" "SafetyEvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "source_url" VARCHAR(2000) NOT NULL,
    "excerpt" VARCHAR(2000) NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_safety_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_reviews" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "status" "SafetyEvidenceStatus" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_id" VARCHAR(255) NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_suppliers_code_key" ON "merchant_suppliers"("code");

-- CreateIndex
CREATE INDEX "external_restaurant_identities_restaurant_id_idx" ON "external_restaurant_identities"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_restaurant_identities_supplier_id_external_id_key" ON "external_restaurant_identities"("supplier_id", "external_id");

-- CreateIndex
CREATE INDEX "external_menu_items_active_is_available_expires_at_idx" ON "external_menu_items"("active", "is_available", "expires_at");

-- CreateIndex
CREATE INDEX "external_menu_items_dish_id_idx" ON "external_menu_items"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_menu_items_identity_id_external_id_key" ON "external_menu_items"("identity_id", "external_id");

-- CreateIndex
CREATE INDEX "menu_sync_runs_supplier_id_status_created_at_idx" ON "menu_sync_runs"("supplier_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "menu_sync_runs_supplier_id_snapshot_id_key" ON "menu_sync_runs"("supplier_id", "snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_sync_pages_run_id_page_key" ON "menu_sync_pages"("run_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "menu_quarantine_run_id_page_row_index_key" ON "menu_quarantine"("run_id", "page", "row_index");

-- CreateIndex
CREATE INDEX "offer_safety_evidence_offer_id_status_expires_at_idx" ON "offer_safety_evidence"("offer_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "evidence_reviews_evidence_id_created_at_idx" ON "evidence_reviews"("evidence_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_created_at_idx" ON "admin_audit"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_target_id_idx" ON "admin_audit"("target_id");

-- AddForeignKey
ALTER TABLE "external_restaurant_identities" ADD CONSTRAINT "external_restaurant_identities_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "merchant_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_restaurant_identities" ADD CONSTRAINT "external_restaurant_identities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_menu_items" ADD CONSTRAINT "external_menu_items_last_sync_run_id_fkey" FOREIGN KEY ("last_sync_run_id") REFERENCES "menu_sync_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE merchant_suppliers ADD CONSTRAINT supplier_evidence_age CHECK (max_evidence_age_hours BETWEEN 1 AND 168);
ALTER TABLE external_menu_items ADD CONSTRAINT offer_price_currency CHECK (price BETWEEN 0 AND 100000000 AND currency = 'VND');
ALTER TABLE external_menu_items ADD CONSTRAINT offer_evidence_dates CHECK (expires_at > observed_at);
ALTER TABLE menu_sync_runs ADD CONSTRAINT sync_page_bound CHECK (expected_pages BETWEEN 1 AND 10);
ALTER TABLE menu_sync_pages ADD CONSTRAINT sync_page_index CHECK (page BETWEEN 0 AND 9);
ALTER TABLE offer_safety_evidence ADD CONSTRAINT safety_evidence_dates CHECK (expires_at > observed_at);

-- AddForeignKey
ALTER TABLE "external_menu_items" ADD CONSTRAINT "external_menu_items_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "external_restaurant_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_menu_items" ADD CONSTRAINT "external_menu_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_sync_runs" ADD CONSTRAINT "menu_sync_runs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "merchant_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_sync_pages" ADD CONSTRAINT "menu_sync_pages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "menu_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_quarantine" ADD CONSTRAINT "menu_quarantine_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "menu_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_safety_evidence" ADD CONSTRAINT "offer_safety_evidence_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "external_menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "offer_safety_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
