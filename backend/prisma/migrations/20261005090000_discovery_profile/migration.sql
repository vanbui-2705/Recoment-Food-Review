ALTER TABLE taste_profiles ADD COLUMN latitude DOUBLE PRECISION, ADD COLUMN longitude DOUBLE PRECISION, ADD COLUMN area_label VARCHAR(200), ADD COLUMN meal_period meal_period;
ALTER TABLE taste_profiles ADD CONSTRAINT profile_location_pair CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND latitude IS NOT NULL AND longitude IS NOT NULL));
ALTER TABLE dishes ADD COLUMN evidence_source VARCHAR(500), ADD COLUMN dietary_codes TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN meal_periods meal_period[] NOT NULL DEFAULT '{}';
CREATE INDEX user_interactions_cooldown_idx ON user_interactions(user_id, interaction_type, created_at DESC, dish_id);
