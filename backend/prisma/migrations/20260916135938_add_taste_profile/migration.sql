-- CreateEnum
CREATE TYPE "allergy_severity" AS ENUM ('UNKNOWN', 'MILD', 'MODERATE', 'SEVERE');

-- CreateTable
CREATE TABLE "taste_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "spicy_level" SMALLINT NOT NULL,
    "sweet_level" SMALLINT NOT NULL,
    "sour_level" SMALLINT NOT NULL,
    "salty_level" SMALLINT NOT NULL,
    "budget_min" INTEGER NOT NULL,
    "budget_max" INTEGER NOT NULL,
    "max_distance_meters" INTEGER NOT NULL,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "taste_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "taste_profiles_flavor_scores_check" CHECK (
        "spicy_level" BETWEEN 0 AND 100 AND
        "sweet_level" BETWEEN 0 AND 100 AND
        "sour_level" BETWEEN 0 AND 100 AND
        "salty_level" BETWEEN 0 AND 100
    ),
    CONSTRAINT "taste_profiles_budget_check" CHECK (
        "budget_min" >= 0 AND
        "budget_max" >= "budget_min"
    ),
    CONSTRAINT "taste_profiles_max_distance_check" CHECK ("max_distance_meters" > 0)
);

-- CreateTable
CREATE TABLE "allergens" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_allergies" (
    "user_id" UUID NOT NULL,
    "allergen_id" UUID NOT NULL,
    "severity" "allergy_severity" NOT NULL DEFAULT 'UNKNOWN',
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_allergies_pkey" PRIMARY KEY ("user_id","allergen_id")
);

-- CreateTable
CREATE TABLE "dietary_restrictions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dietary_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dietary_restrictions" (
    "user_id" UUID NOT NULL,
    "dietary_restriction_id" UUID NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_dietary_restrictions_pkey" PRIMARY KEY ("user_id","dietary_restriction_id")
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cuisine_preferences" (
    "user_id" UUID NOT NULL,
    "cuisine_id" UUID NOT NULL,
    "preference_score" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_cuisine_preferences_pkey" PRIMARY KEY ("user_id","cuisine_id"),
    CONSTRAINT "user_cuisine_preferences_score_check" CHECK ("preference_score" BETWEEN -100 AND 100)
);

-- CreateIndex
CREATE UNIQUE INDEX "taste_profiles_user_id_key" ON "taste_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_code_key" ON "allergens"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dietary_restrictions_code_key" ON "dietary_restrictions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_code_key" ON "cuisines"("code");

-- AddForeignKey
ALTER TABLE "taste_profiles" ADD CONSTRAINT "taste_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "allergens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dietary_restrictions" ADD CONSTRAINT "user_dietary_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dietary_restrictions" ADD CONSTRAINT "user_dietary_restrictions_dietary_restriction_id_fkey" FOREIGN KEY ("dietary_restriction_id") REFERENCES "dietary_restrictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cuisine_preferences" ADD CONSTRAINT "user_cuisine_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cuisine_preferences" ADD CONSTRAINT "user_cuisine_preferences_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "cuisines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
