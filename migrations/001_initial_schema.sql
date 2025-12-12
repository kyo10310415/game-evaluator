-- ゲーム情報テーブル
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  game_type VARCHAR(50) NOT NULL, -- 'consumer' or 'social'
  release_date DATE,
  developer VARCHAR(255),
  publisher VARCHAR(255),
  platforms TEXT[], -- Array of platforms
  description TEXT,
  image_url TEXT,
  source_url TEXT,
  rawg_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- アップデート情報テーブル
CREATE TABLE IF NOT EXISTS game_updates (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  update_date DATE NOT NULL,
  description TEXT,
  version VARCHAR(100),
  source_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 評価結果テーブル
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  update_id INTEGER REFERENCES game_updates(id) ON DELETE CASCADE,
  evaluation_type VARCHAR(50) NOT NULL, -- 'new_release' or 'update'
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  trend_score FLOAT,
  brand_score FLOAT,
  series_score FLOAT,
  sales_score FLOAT,
  reasoning TEXT,
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  evaluation_date DATE NOT NULL,
  CONSTRAINT check_game_or_update CHECK (
    (game_id IS NOT NULL AND update_id IS NULL) OR
    (game_id IS NULL AND update_id IS NOT NULL)
  )
);

-- トレンドデータテーブル
CREATE TABLE IF NOT EXISTS trend_data (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  trend_value FLOAT,
  data_source VARCHAR(50), -- 'google_trends', 'twitter', etc.
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_range_start DATE,
  date_range_end DATE
);

-- Slack通知履歴テーブル
CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  notification_type VARCHAR(50),
  message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20), -- 'success' or 'failed'
  error_message TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_games_release_date ON games(release_date);
CREATE INDEX IF NOT EXISTS idx_games_game_type ON games(game_type);
CREATE INDEX IF NOT EXISTS idx_game_updates_update_date ON game_updates(update_date);
CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(score DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluation_date ON evaluations(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_evaluations_type ON evaluations(evaluation_type);
CREATE INDEX IF NOT EXISTS idx_trend_data_keyword ON trend_data(keyword);
CREATE INDEX IF NOT EXISTS idx_trend_data_collected_at ON trend_data(collected_at);
