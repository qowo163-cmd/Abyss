CREATE TABLE IF NOT EXISTS discord_links (
  member_id VARCHAR(36) NOT NULL PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL UNIQUE,
  discord_username VARCHAR(100) NULL,
  linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS discord_link_codes (
  code VARCHAR(12) NOT NULL PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  INDEX discord_link_codes_member_idx (member_id),
  INDEX discord_link_codes_expires_idx (expires_at)
);
CREATE TABLE IF NOT EXISTS discord_notifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  recipient_member_id VARCHAR(36) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(500) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  INDEX discord_notifications_pending_idx (sent_at, created_at),
  INDEX discord_notifications_recipient_idx (recipient_member_id, created_at)
);
