-- Steam/Google Play IDのUNIQUE制約を修正
-- 部分インデックスを削除して完全なUNIQUE制約に置き換える

-- 既存の部分インデックスを削除
DROP INDEX IF EXISTS unique_steam_app_id;
DROP INDEX IF EXISTS unique_google_play_id;

-- 完全なUNIQUE制約を追加（NULL値は許可されるが、NULLでない値は一意である必要がある）
-- PostgreSQLでは、NULL値は互いに異なるとみなされるため、複数のNULL値を持つことができる
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_steam_app_id' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games ADD CONSTRAINT unique_steam_app_id UNIQUE (steam_app_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_google_play_id' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games ADD CONSTRAINT unique_google_play_id UNIQUE (google_play_id);
  END IF;
END $$;

-- インデックスは既に存在するため再作成不要
-- idx_games_steam_app_id と idx_games_google_play_id は維持される
