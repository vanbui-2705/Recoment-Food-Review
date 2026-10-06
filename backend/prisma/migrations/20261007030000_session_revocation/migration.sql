ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0 CHECK (auth_version >= 0);
ALTER TABLE refresh_tokens ADD COLUMN family_id UUID;
ALTER TABLE refresh_tokens ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0 CHECK (auth_version >= 0);

-- Preserve the device family across already rotated tokens, including revoked ancestors.
WITH RECURSIVE families AS (
  SELECT id, id AS family, replaced_by_token_id, ARRAY[id] AS path
  FROM refresh_tokens r
  WHERE NOT EXISTS (SELECT 1 FROM refresh_tokens predecessor WHERE predecessor.replaced_by_token_id = r.id)
  UNION ALL
  SELECT child.id, parent.family, child.replaced_by_token_id, parent.path || child.id
  FROM families parent JOIN refresh_tokens child ON child.id = parent.replaced_by_token_id
  WHERE NOT child.id = ANY(parent.path)
)
UPDATE refresh_tokens r SET family_id = families.family FROM families WHERE families.id = r.id;
UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
CREATE INDEX refresh_tokens_user_id_family_id_revoked_at_idx ON refresh_tokens(user_id, family_id, revoked_at);
