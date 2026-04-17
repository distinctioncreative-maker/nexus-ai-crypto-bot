-- Explicit paper/live execution state.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS engine_status TEXT DEFAULT 'STOPPED';
