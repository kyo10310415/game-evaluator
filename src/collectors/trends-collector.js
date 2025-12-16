import googleTrends from 'google-trends-api';
import dayjs from 'dayjs';

/**
 * Google Trendsからトレンドデータを取得
 */
export class TrendsCollector {
  constructor() {
    this.geo = 'JP'; // 日本のトレンド
  }

  /**
   * キーワードのトレンドスコアを取得
   */
  async getTrendScore(keyword) {
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(30, 'day');
      
      console.log(`Fetching Google Trends for: ${keyword}`);
      
      const result = await googleTrends.interestOverTime({
        keyword: keyword,
        startTime: startDate.toDate(),
        endTime: endDate.toDate(),
        geo: this.geo
      });
      
      // HTML応答のチェック（レート制限エラー）
      if (typeof result === 'string' && result.trim().startsWith('<')) {
        console.warn(`Google Trends rate limit or error for "${keyword}", skipping`);
        return 0;
      }
      
      const data = JSON.parse(result);
      
      if (!data.default || !data.default.timelineData || data.default.timelineData.length === 0) {
        console.log(`No trend data found for: ${keyword}`);
        return 0;
      }
      
      // 過去30日間の平均トレンド値を計算
      const timelineData = data.default.timelineData;
      const values = timelineData.map(item => item.value[0]);
      const averageScore = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      console.log(`✓ Trend score for "${keyword}": ${averageScore.toFixed(2)}`);
      
      return averageScore;
    } catch (error) {
      if (error.message && error.message.includes('Unexpected token')) {
        console.warn(`Google Trends parse error for "${keyword}" (rate limit?), returning 0`);
      } else {
        console.error(`Error fetching trends for "${keyword}":`, error.message);
      }
      return 0;
    }
  }

  /**
   * 複数キーワードのトレンドスコアを取得（レート制限対策）
   */
  async getBatchTrendScores(keywords) {
    const results = {};
    
    for (const keyword of keywords) {
      // Google TrendsのAPI制限を考慮して遅延を入れる
      await this.delay(2000);
      results[keyword] = await this.getTrendScore(keyword);
    }
    
    return results;
  }

  /**
   * ゲームタイトルに関連するトレンドキーワードを生成
   */
  generateTrendKeywords(gameTitle, developer = null) {
    const keywords = [gameTitle];
    
    // タイトルが長い場合、主要な単語を抽出
    if (gameTitle.length > 30) {
      const words = gameTitle.split(/[\s:：-]+/);
      if (words.length > 1) {
        keywords.push(words[0]); // 最初の単語（シリーズ名など）
      }
    }
    
    // 開発元も追加（有名メーカーの場合）
    if (developer) {
      const famousPublishers = [
        'Nintendo', 'Sony', 'Microsoft', 'Capcom', 'Square Enix',
        'Bandai Namco', 'Sega', 'Konami', 'FromSoftware', 'Atlus'
      ];
      
      if (famousPublishers.some(pub => developer.includes(pub))) {
        keywords.push(developer);
      }
    }
    
    return keywords.slice(0, 2); // 最大2つのキーワード（API制限対策）
  }

  /**
   * ゲームに対する総合トレンドスコアを計算
   */
  async calculateGameTrendScore(gameData) {
    try {
      const keywords = this.generateTrendKeywords(
        gameData.title,
        gameData.developer || gameData.publisher
      );
      
      const scores = await this.getBatchTrendScores(keywords);
      
      // 平均スコアを計算
      const validScores = Object.values(scores).filter(score => score > 0);
      
      if (validScores.length === 0) {
        return 0;
      }
      
      const averageScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
      
      return Math.min(averageScore / 10, 10); // 10点満点にスケール
    } catch (error) {
      console.error('Error calculating game trend score:', error.message);
      return 0;
    }
  }

  /**
   * APIレート制限を考慮した待機
   */
  async delay(ms = 2000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TrendsCollector;
