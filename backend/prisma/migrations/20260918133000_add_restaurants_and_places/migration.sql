-- CreateEnum
CREATE TYPE "restaurant_business_status" AS ENUM ('UNKNOWN', 'OPERATIONAL', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL,
    "google_place_id" VARCHAR(255),
    "name" VARCHAR(200) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "rating" DECIMAL(2,1),
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "price_level" SMALLINT,
    "business_status" "restaurant_business_status" NOT NULL DEFAULT 'UNKNOWN',
    "places_data_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "restaurants_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "restaurants_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
    CONSTRAINT "restaurants_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 0 AND 5),
    CONSTRAINT "restaurants_rating_count_check" CHECK ("rating_count" >= 0),
    CONSTRAINT "restaurants_price_level_check" CHECK ("price_level" IS NULL OR "price_level" BETWEEN 0 AND 4)
);

-- CreateTable
CREATE TABLE "restaurant_dishes" (
    "restaurant_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(500) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "restaurant_dishes_pkey" PRIMARY KEY ("restaurant_id", "dish_id"),
    CONSTRAINT "restaurant_dishes_price_check" CHECK ("price" >= 0),
    CONSTRAINT "restaurant_dishes_source_check" CHECK (btrim("source") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_google_place_id_key" ON "restaurants"("google_place_id");

-- CreateIndex
CREATE INDEX "restaurants_latitude_longitude_idx" ON "restaurants"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "restaurant_dishes_dish_id_idx" ON "restaurant_dishes"("dish_id");

-- AddForeignKey
ALTER TABLE "restaurant_dishes" ADD CONSTRAINT "restaurant_dishes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_dishes" ADD CONSTRAINT "restaurant_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
