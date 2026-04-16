-- Quant by Distinction Creative — persistence schema

-- User configuration + trading state snapshot
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          UUID        PRIMARY KEY,
  cb_key_enc       TEXT,
  cb_sec_enc       TEXT,
  gem_key_enc      TEXT,
  balance          NUMERIC     DEFAULT 100000,
  asset_holdings   NUMERIC     DEFAULT 0,
  selected_product TEXT        DEFAULT 'BTC-USD',
  trading_mode     TEXT        DEFAULT 'FULL_AUTO',
  is_live_mode     BOOLEAN     DEFAULT false,
  risk_settings    JSONB       DEFAULT '{}',
  circuit_breaker  JSONB       DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Full trade history (paper + live mirrored)
CREATE TABLE IF NOT EXISTS paper_trades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  type        TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL,
  price       NUMERIC     NOT NULL,
  product     TEXT        NOT NULL,
  reason      TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paper_trades_user_time ON paper_trades(user_id, executed_at DESC);

-- AI self-learning history
CREATE TABLE IF NOT EXISTS learning_history (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  knowledge  TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_history_user_time ON learning_history(user_id, created_at DESC);

-- Strategy tournament state per user
CREATE TABLE IF NOT EXISTS strategies (
  id         TEXT        NOT NULL,
  user_id    UUID        NOT NULL,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
