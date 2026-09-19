-- Replace the original rating check so SQL NULL cannot satisfy the RATED branch.
ALTER TABLE "user_interactions" DROP CONSTRAINT "user_interactions_rating_check";

ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_rating_check" CHECK (
    ("interaction_type" = 'RATED' AND "rating" IS NOT NULL AND "rating" BETWEEN 1 AND 5) OR
    ("interaction_type" <> 'RATED' AND "rating" IS NULL)
);
