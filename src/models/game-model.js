import { query } from '../utils/database.js';

/**
 * ゲーム情報のデータベース操作
 */
export class GameModel {
  /**
   * ゲームを保存または更新
   */
  static async upsertGame(gameData) {
    try {
      const sql = `
        INSERT INTO games (
          title, game_type, release_date, developer, publisher,
          platforms, description, image_url, source_url, rawg_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (rawg_id) 
        DO UPDATE SET
          title = EXCLUDED.title,
          release_date = EXCLUDED.release_date,
          developer = EXCLUDED.developer,
          publisher = EXCLUDED.publisher,
          platforms = EXCLUDED.platforms,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      
      const values = [
        gameData.title,
        gameData.game_type,
        gameData.release_date,
        gameData.developer,
        gameData.publisher,
        gameData.platforms,
        gameData.description,
        gameData.image_url,
        gameData.source_url,
        gameData.rawg_id
      ];
      
      const result = await query(sql, values);
      return result.rows[0].id;
    } catch (error) {
      // rawg_idがnullの場合、タイトルベースで重複チェック
      if (!gameData.rawg_id) {
        return await this.upsertGameByTitle(gameData);
      }
      throw error;
    }
  }

  /**
   * タイトルベースでゲームを保存または更新
   */
  static async upsertGameByTitle(gameData) {
    try {
      // 既存チェック
      const existing = await this.findByTitle(gameData.title, gameData.release_date);
      
      if (existing) {
        // 更新
        const sql = `
          UPDATE games SET
            developer = $1,
            publisher = $2,
            platforms = $3,
            description = $4,
            image_url = $5,
            source_url = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
          RETURNING id
        `;
        
        const values = [
          gameData.developer,
          gameData.publisher,
          gameData.platforms,
          gameData.description,
          gameData.image_url,
          gameData.source_url,
          existing.id
        ];
        
        const result = await query(sql, values);
        return result.rows[0].id;
      } else {
        // 新規挿入
        const sql = `
          INSERT INTO games (
            title, game_type, release_date, developer, publisher,
            platforms, description, image_url, source_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;
        
        const values = [
          gameData.title,
          gameData.game_type,
          gameData.release_date,
          gameData.developer,
          gameData.publisher,
          gameData.platforms,
          gameData.description,
          gameData.image_url,
          gameData.source_url
        ];
        
        const result = await query(sql, values);
        return result.rows[0].id;
      }
    } catch (error) {
      console.error('Error upserting game by title:', error);
      throw error;
    }
  }

  /**
   * タイトルでゲームを検索
   */
  static async findByTitle(title, releaseDate = null) {
    try {
      let sql = 'SELECT * FROM games WHERE title = $1';
      const values = [title];
      
      if (releaseDate) {
        sql += ' AND release_date = $2';
        values.push(releaseDate);
      }
      
      sql += ' LIMIT 1';
      
      const result = await query(sql, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding game by title:', error);
      return null;
    }
  }

  /**
   * 日付範囲でゲームを取得
   */
  static async findByDateRange(startDate, endDate, gameType = null) {
    try {
      let sql = `
        SELECT * FROM games
        WHERE release_date >= $1 AND release_date <= $2
      `;
      const values = [startDate, endDate];
      
      if (gameType) {
        sql += ' AND game_type = $3';
        values.push(gameType);
      }
      
      sql += ' ORDER BY release_date DESC';
      
      const result = await query(sql, values);
      return result.rows;
    } catch (error) {
      console.error('Error finding games by date range:', error);
      return [];
    }
  }

  /**
   * 評価済みゲームを取得
   */
  static async findEvaluatedGames(evaluationDate, limit = 100) {
    try {
      const sql = `
        SELECT 
          g.*,
          e.score as evaluation_score,
          e.trend_score,
          e.brand_score,
          e.series_score,
          e.sales_score,
          e.reasoning,
          e.evaluated_at
        FROM games g
        INNER JOIN evaluations e ON g.id = e.game_id
        WHERE e.evaluation_date = $1
        ORDER BY e.score DESC
        LIMIT $2
      `;
      
      const result = await query(sql, [evaluationDate, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error finding evaluated games:', error);
      return [];
    }
  }
}

export default GameModel;
