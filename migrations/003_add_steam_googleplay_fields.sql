-- Steam App ID と Google Play ID を追加
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_app_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS google_play_id VARCHAR(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS rating FLOAT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS installs VARCHAR(50);
ALTER TABLE games ADD COLUMN IF NOT EXISTS genre VARCHAR(255);

-- game_updates テーブルに Steam/Google Play 対応
ALTER TABLE game_updates ADD COLUMN IF NOT EXISTS steam_app_id INTEGER;
ALTER TABLE game_updates ADD COLUMN IF NOT EXISTS google_play_id VARCHAR(255);

-- UNIQUE制約追加（Steam/Google Play ID用）
-- Note: These partial indexes will be replaced by full constraints in 004_fix_unique_constraints.sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_steam_app_id ON games(steam_app_id) WHERE steam_app_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_google_play_id ON games(google_play_id) WHERE google_play_id IS NOT NULL;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_games_steam_app_id ON games(steam_app_id);
CREATE INDEX IF NOT EXISTS idx_games_google_play_id ON games(google_play_id);
