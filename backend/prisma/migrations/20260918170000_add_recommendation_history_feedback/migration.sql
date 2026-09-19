-- CreateEnum
CREATE TYPE "recommendation_status" AS ENUM ('SUCCESS', 'NO_MATCH', 'NO_SAFE_MATCH', 'INSUFFICIENT_DATA', 'FAILED');

-- CreateEnum
CREATE TYPE "meal_period" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'LATE_NIGHT');

-- CreateEnum
CREATE TYPE "user_interaction_type" AS ENUM ('VIEWED', 'LIKED', 'SKIPPED', 'CHOSEN', 'EATEN', 'RATED');

-- CreateTable
CREATE TABLE "recommendation_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "meal_period" "meal_period",
    "weather" VARCHAR(100),
    "budget_min" INTEGER,
    "budget_max" INTEGER,
    "max_distance_meters" INTEGER,
    "natural_language_request" VARCHAR(1000),
    "status" "recommendation_status" NOT NULL,

    CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recommendation_requests_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "recommendation_requests_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
    CONSTRAINT "recommendation_requests_budget_check" CHECK (
        ("budget_min" IS NULL AND "budget_max" IS NULL) OR
        ("budget_min" IS NOT NULL AND "budget_max" IS NOT NULL AND "budget_min" >= 0 AND "budget_max" >= "budget_min")
    ),
    CONSTRAINT "recommendation_requests_distance_check" CHECK ("max_distance_meters" IS NULL OR "max_distance_meters" > 0)
);

-- CreateTable
CREATE TABLE "recommendation_results" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "restaurant_id" UUID,
    "rank" INTEGER NOT NULL,
    "base_score" DECIMAL(7,4) NOT NULL,
    "final_score" DECIMAL(7,4) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "safety_warnings" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recommendation_results_rank_check" CHECK ("rank" > 0),
    CONSTRAINT "recommendation_results_scores_check" CHECK (
        "base_score" BETWEEN 0 AND 100 AND "final_score" BETWEEN 0 AND 100
    ),
    CONSTRAINT "recommendation_results_reason_check" CHECK (btrim("reason") <> ''),
    CONSTRAINT "recommendation_results_safety_warnings_check" CHECK (jsonb_typeof("safety_warnings") = 'array')
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recommendation_result_id" UUID,
    "dish_id" UUID NOT NULL,
    "restaurant_id" UUID,
    "interaction_type" "user_interaction_type" NOT NULL,
    "rating" SMALLINT,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_interactions_rating_check" CHECK (
        ("interaction_type" = 'RATED' AND "rating" BETWEEN 1 AND 5) OR
        ("interaction_type" <> 'RATED' AND "rating" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "recommendation_requests_user_id_requested_at_idx" ON "recommendation_requests"("user_id", "requested_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_results_request_id_rank_key" ON "recommendation_results"("request_id", "rank");

-- CreateIndex
CREATE INDEX "recommendation_results_dish_id_idx" ON "recommendation_results"("dish_id");

-- CreateIndex
CREATE INDEX "recommendation_results_restaurant_id_idx" ON "recommendation_results"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_interactions_idempotency_key_key" ON "user_interactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "user_interactions_user_id_created_at_idx" ON "user_interactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_interactions_recommendation_result_id_idx" ON "user_interactions"("recommendation_result_id");

-- CreateIndex
CREATE INDEX "user_interactions_dish_id_idx" ON "user_interactions"("dish_id");

-- CreateIndex
CREATE INDEX "user_interactions_restaurant_id_idx" ON "user_interactions"("restaurant_id");

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "recommendation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_recommendation_result_id_fkey" FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
