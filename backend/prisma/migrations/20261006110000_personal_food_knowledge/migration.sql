CREATE TABLE "personal_food_knowledge" (
  "user_id" UUID NOT NULL,
  "description" VARCHAR(6000) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "analyzed_revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "personal_food_knowledge_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "personal_food_knowledge_revision_check" CHECK ("revision" > 0 AND "analyzed_revision" >= 0 AND "analyzed_revision" <= "revision"),
  CONSTRAINT "personal_food_knowledge_description_check" CHECK (length(btrim("description")) > 0),
  CONSTRAINT "personal_food_knowledge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
