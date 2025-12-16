-- rawg_id に UNIQUE 制約を追加（既に存在する場合はスキップ）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_rawg_id'
  ) THEN
    ALTER TABLE games ADD CONSTRAINT unique_rawg_id UNIQUE (rawg_id);
  END IF;
END $$;

-- タイトルと game_type の組み合わせにもUNIQUE制約を追加（rawg_idがnullの場合のバックアップ）
CREATE UNIQUE INDEX IF NOT EXISTS unique_title_game_type ON games(title, game_type) WHERE rawg_id IS NULL;
