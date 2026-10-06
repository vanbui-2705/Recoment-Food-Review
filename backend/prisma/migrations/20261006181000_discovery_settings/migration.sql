-- AlterTable
ALTER TABLE "recommendation_requests" ADD COLUMN     "only_open" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "discovery_settings" (
    "user_id" UUID NOT NULL,
    "budget" INTEGER NOT NULL DEFAULT 50000,
    "radius" INTEGER NOT NULL DEFAULT 3500,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "only_open" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "discovery_settings_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "discovery_settings" ADD CONSTRAINT "discovery_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE discovery_settings ADD CONSTRAINT discovery_settings_bounds CHECK (budget BETWEEN 1000 AND 100000000 AND radius BETWEEN 3000 AND 4000 AND ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)));
