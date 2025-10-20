-- Remove web search functionality from assistant_settings
ALTER TABLE assistant_settings DROP COLUMN IF EXISTS enable_web_search;