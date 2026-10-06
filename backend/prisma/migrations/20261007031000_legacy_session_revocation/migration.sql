-- Legacy access tokens lack device-family claims. Revoking any device disables
-- those old access tokens without revoking other modern device families.
ALTER TABLE users ADD COLUMN legacy_access_disabled BOOLEAN NOT NULL DEFAULT FALSE;
