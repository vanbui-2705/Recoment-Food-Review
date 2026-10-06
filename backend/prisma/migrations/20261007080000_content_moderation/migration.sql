ALTER TABLE dishes ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE restaurants ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE cuisines ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ingredients ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE external_menu_items ADD COLUMN moderation_enabled boolean NOT NULL DEFAULT true;
CREATE INDEX dishes_moderation_idx ON dishes(is_active,id);
CREATE INDEX restaurants_moderation_idx ON restaurants(is_active,id);
CREATE INDEX external_menu_items_moderation_idx ON external_menu_items(moderation_enabled,id);
