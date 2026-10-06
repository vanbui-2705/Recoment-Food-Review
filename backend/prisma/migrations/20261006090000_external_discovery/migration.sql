CREATE TABLE "recipe_interactions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "source" VARCHAR(30) NOT NULL,
  "recipe_id" VARCHAR(30) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "canonical_name" VARCHAR(200) NOT NULL,
  "interaction_type" "user_interaction_type" NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_interactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_interactions_source_check" CHECK ("source" IN ('themealdb', 'spoonacular')),
  CONSTRAINT "recipe_interactions_type_check" CHECK ("interaction_type" IN ('CHOSEN', 'EATEN')),
  CONSTRAINT "recipe_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "recipe_interactions_idempotency_key_key" ON "recipe_interactions"("idempotency_key");
CREATE INDEX "recipe_interactions_user_id_created_at_idx" ON "recipe_interactions"("user_id", "created_at" DESC);
CREATE INDEX "recipe_interactions_user_id_canonical_name_idx" ON "recipe_interactions"("user_id", "canonical_name");
