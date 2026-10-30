-- Bumped on password reset / deactivation so existing logins stop working immediately.
ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_active;
