-- rawg_id に UNIQUE 制約を追加
ALTER TABLE games ADD CONSTRAINT unique_rawg_id UNIQUE (rawg_id);

-- タイトルと game_type の組み合わせにもUNIQUE制約を追加（rawg_idがnullの場合のバックアップ）
CREATE UNIQUE INDEX unique_title_game_type ON games(title, game_type) WHERE rawg_id IS NULL;
