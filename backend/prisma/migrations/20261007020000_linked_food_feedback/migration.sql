ALTER TABLE user_interactions ADD COLUMN feedback_of_id UUID REFERENCES user_interactions(id) ON DELETE SET NULL;
CREATE INDEX user_interactions_feedback_of_id_created_at_idx ON user_interactions(feedback_of_id, created_at DESC);
ALTER TABLE recipe_interactions
 ADD COLUMN canonical_dish_id UUID REFERENCES dishes(id) ON DELETE RESTRICT,
 ADD COLUMN rating SMALLINT,
 ADD COLUMN feedback_of_id UUID REFERENCES recipe_interactions(id) ON DELETE SET NULL,
 ADD CONSTRAINT recipe_interactions_rating_semantics CHECK(
   (interaction_type='RATED' AND rating IS NOT NULL AND rating BETWEEN 1 AND 5) OR
   (interaction_type<>'RATED' AND rating IS NULL)
 );
CREATE INDEX recipe_interactions_canonical_dish_id_idx ON recipe_interactions(canonical_dish_id);
CREATE INDEX recipe_interactions_feedback_of_id_created_at_idx ON recipe_interactions(feedback_of_id, created_at DESC);
