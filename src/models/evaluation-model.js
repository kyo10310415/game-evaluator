import { query } from '../utils/database.js';

/**
 * 評価結果のデータベース操作
 */
export class EvaluationModel {
  /**
   * 評価を保存
   */
  static async saveEvaluation(gameId, evaluationData, evaluationDate, evaluationType = 'new_release') {
    try {
      const sql = `
        INSERT INTO evaluations (
          game_id, evaluation_type, score, trend_score, brand_score,
          series_score, sales_score, reasoning, evaluation_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        gameId,
        evaluationType,
        Math.round(evaluationData.total_score),
        evaluationData.trend_score,
        evaluationData.brand_score,
        evaluationData.series_score,
        evaluationData.sales_score,
        evaluationData.reasoning,
        evaluationDate
      ];
      
      const result = await query(sql, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving evaluation:', error);
      throw error;
    }
  }

  /**
   * 日付別の評価ランキングを取得
   */
  static async getRankingByDate(evaluationDate, gameType = null, limit = 50) {
    try {
      let sql = `
        SELECT 
          g.id,
          g.title,
          g.game_type,
          g.release_date,
          g.developer,
          g.publisher,
          g.platforms,
          g.image_url,
          g.source_url,
          e.score,
          e.trend_score,
          e.brand_score,
          e.series_score,
          e.sales_score,
          e.reasoning,
          e.evaluation_type,
          e.evaluated_at,
          ROW_NUMBER() OVER (ORDER BY e.score DESC, e.evaluated_at DESC) as rank
        FROM evaluations e
        INNER JOIN games g ON e.game_id = g.id
        WHERE e.evaluation_date = $1
      `;
      
      const values = [evaluationDate];
      
      if (gameType) {
        sql += ' AND g.game_type = $2';
        values.push(gameType);
      }
      
      sql += `
        ORDER BY e.score DESC, e.evaluated_at DESC
        LIMIT $${values.length + 1}
      `;
      values.push(limit);
      
      const result = await query(sql, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting ranking:', error);
      return [];
    }
  }

  /**
   * 最新の評価日を取得
   */
  static async getLatestEvaluationDate() {
    try {
      const sql = `
        SELECT evaluation_date
        FROM evaluations
        ORDER BY evaluation_date DESC
        LIMIT 1
      `;
      
      const result = await query(sql);
      return result.rows[0]?.evaluation_date || null;
    } catch (error) {
      console.error('Error getting latest evaluation date:', error);
      return null;
    }
  }

  /**
   * 評価統計を取得
   */
  static async getEvaluationStats(evaluationDate) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_games,
          AVG(score) as average_score,
          MAX(score) as max_score,
          MIN(score) as min_score,
          COUNT(CASE WHEN g.game_type = 'consumer' THEN 1 END) as consumer_count,
          COUNT(CASE WHEN g.game_type = 'social' THEN 1 END) as social_count
        FROM evaluations e
        INNER JOIN games g ON e.game_id = g.id
        WHERE e.evaluation_date = $1
      `;
      
      const result = await query(sql, [evaluationDate]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting evaluation stats:', error);
      return null;
    }
  }

  /**
   * スコア別の分布を取得
   */
  static async getScoreDistribution(evaluationDate) {
    try {
      const sql = `
        SELECT 
          score,
          COUNT(*) as count
        FROM evaluations
        WHERE evaluation_date = $1
        GROUP BY score
        ORDER BY score DESC
      `;
      
      const result = await query(sql, [evaluationDate]);
      return result.rows;
    } catch (error) {
      console.error('Error getting score distribution:', error);
      return [];
    }
  }
}

export default EvaluationModel;
