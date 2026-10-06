ALTER TABLE recipe_interactions DROP CONSTRAINT recipe_interactions_type_check;
ALTER TABLE recipe_interactions ADD CONSTRAINT recipe_interactions_type_check CHECK(interaction_type IN ('CHOSEN','EATEN','RATED','LIKED','SKIPPED'));
