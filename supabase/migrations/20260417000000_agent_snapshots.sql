-- Agent training data audit trail
-- Records a snapshot of all strategy agents after every tournament cycle
CREATE TABLE IF NOT EXISTS agent_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL,
  snapshot_at          TIMESTAMPTZ DEFAULT now(),
  tournament_generation INT,
  strategies           JSONB,
  top_strategy         TEXT,
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_snapshots_user ON agent_snapshots(user_id, snapshot_at DESC);
