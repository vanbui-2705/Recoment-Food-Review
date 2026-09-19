-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('UNVERIFIED', 'REVIEWED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "allergen_presence" AS ENUM ('CONTAINS', 'MAY_CONTAIN');

-- CreateEnum
CREATE TYPE "dish_preference_value" AS ENUM ('LIKED', 'DISLIKED');

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "cuisine_id" UUID NOT NULL,
    "price_min" INTEGER NOT NULL,
    "price_max" INTEGER NOT NULL,
    "spicy_level" SMALLINT NOT NULL,
    "sweet_level" SMALLINT NOT NULL,
    "sour_level" SMALLINT NOT NULL,
    "salty_level" SMALLINT NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dishes_price_range_check" CHECK (
        "price_min" >= 0 AND
        "price_max" >= "price_min"
    ),
    CONSTRAINT "dishes_flavor_scores_check" CHECK (
        "spicy_level" BETWEEN 0 AND 100 AND
        "sweet_level" BETWEEN 0 AND 100 AND
        "sour_level" BETWEEN 0 AND 100 AND
        "salty_level" BETWEEN 0 AND 100
    )
);

-- CreateTable
CREATE TABLE "dish_aliases" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "alias" VARCHAR(150) NOT NULL,
    "normalized_alias" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_ingredients" (
    "dish_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_ingredients_pkey" PRIMARY KEY ("dish_id", "ingredient_id")
);

-- CreateTable
CREATE TABLE "dish_allergens" (
    "dish_id" UUID NOT NULL,
    "allergen_id" UUID NOT NULL,
    "presence" "allergen_presence" NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "evidence_source" VARCHAR(500) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_allergens_pkey" PRIMARY KEY ("dish_id", "allergen_id"),
    CONSTRAINT "dish_allergens_evidence_source_check" CHECK (btrim("evidence_source") <> ''),
    CONSTRAINT "dish_allergens_verified_at_check" CHECK (
        "verification_status" <> 'VERIFIED' OR "verified_at" IS NOT NULL
    )
);

-- CreateTable
CREATE TABLE "user_dish_preferences" (
    "user_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "preference" "dish_preference_value" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_dish_preferences_pkey" PRIMARY KEY ("user_id", "dish_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dishes_slug_key" ON "dishes"("slug");

-- CreateIndex
CREATE INDEX "dishes_cuisine_id_idx" ON "dishes"("cuisine_id");

-- CreateIndex
CREATE UNIQUE INDEX "dish_aliases_dish_id_normalized_alias_key" ON "dish_aliases"("dish_id", "normalized_alias");

-- CreateIndex
CREATE INDEX "dish_aliases_normalized_alias_idx" ON "dish_aliases"("normalized_alias");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- CreateIndex
CREATE INDEX "dish_ingredients_ingredient_id_idx" ON "dish_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "dish_allergens_allergen_id_idx" ON "dish_allergens"("allergen_id");

-- CreateIndex
CREATE INDEX "user_dish_preferences_dish_id_idx" ON "user_dish_preferences"("dish_id");

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "cuisines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_aliases" ADD CONSTRAINT "dish_aliases_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergens" ADD CONSTRAINT "dish_allergens_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergens" ADD CONSTRAINT "dish_allergens_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "allergens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dish_preferences" ADD CONSTRAINT "user_dish_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dish_preferences" ADD CONSTRAINT "user_dish_preferences_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
