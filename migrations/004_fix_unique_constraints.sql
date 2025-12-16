-- Steam/Google Play IDのUNIQUE制約を修正
-- 既存のCONSTRAINTまたはINDEXを削除して完全なUNIQUE制約に置き換える

-- まず、CONSTRAINTとして存在するか確認して削除
DO $$ 
BEGIN
  -- unique_steam_app_id制約を削除（存在する場合）
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_steam_app_id' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games DROP CONSTRAINT unique_steam_app_id;
    RAISE NOTICE 'Dropped constraint unique_steam_app_id';
  END IF;

  -- unique_google_play_id制約を削除（存在する場合）
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_google_play_id' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games DROP CONSTRAINT unique_google_play_id;
    RAISE NOTICE 'Dropped constraint unique_google_play_id';
  END IF;
END $$;

-- 次に、INDEXとして存在するか確認して削除
DO $$ 
BEGIN
  -- unique_steam_app_idインデックスを削除（存在する場合）
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'unique_steam_app_id'
  ) THEN
    DROP INDEX unique_steam_app_id;
    RAISE NOTICE 'Dropped index unique_steam_app_id';
  END IF;

  -- unique_google_play_idインデックスを削除（存在する場合）
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'unique_google_play_id'
  ) THEN
    DROP INDEX unique_google_play_id;
    RAISE NOTICE 'Dropped index unique_google_play_id';
  END IF;
END $$;

-- 完全なUNIQUE制約を追加（NULL値は許可されるが、NULLでない値は一意である必要がある）
-- PostgreSQLでは、NULL値は互いに異なるとみなされるため、複数のNULL値を持つことができる
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_steam_app_id_unique' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games ADD CONSTRAINT games_steam_app_id_unique UNIQUE (steam_app_id);
    RAISE NOTICE 'Created constraint games_steam_app_id_unique';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_google_play_id_unique' AND conrelid = 'games'::regclass
  ) THEN
    ALTER TABLE games ADD CONSTRAINT games_google_play_id_unique UNIQUE (google_play_id);
    RAISE NOTICE 'Created constraint games_google_play_id_unique';
  END IF;
END $$;

-- インデックスは既に存在するため再作成不要
-- idx_games_steam_app_id と idx_games_google_play_id は維持される
