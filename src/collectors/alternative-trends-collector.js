import axios from 'axios';
import dayjs from 'dayjs';

/**
 * 代替トレンドデータ収集
 * 複数ソースからトレンドデータを取得（フォールバック対応）
 */
export class AlternativeTrendsCollector {
  constructor() {
    this.wikipediaBaseUrl = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
    this.redditBaseUrl = 'https://www.reddit.com/search.json';
    // RAWG APIキー（環境変数から取得）
    this.rawgApiKey = process.env.RAWG_API_KEY;
    if (!this.rawgApiKey) {
      console.warn('RAWG_API_KEY not found, trend scores will be limited');
    }
  }

  /**
   * キーワードのトレンドスコアを取得（RAWG API使用）
   */
  async getTrendScore(keyword) {
    try {
      console.log(`Fetching trend data for: ${keyword}`);
      
      // RAWG APIでゲームを検索し、added（ウィッシュリスト追加数）を取得
      const rawgScore = await this.getRAWGTrendScore(keyword);
      
      if (rawgScore > 0) {
        console.log(`✓ Trend score for "${keyword}": ${rawgScore.toFixed(2)} (from RAWG wishlist data)`);
        return rawgScore;
      }
      
      // RAWGで見つからない場合、Wikipediaを試行
      const wikipediaScore = await this.getWikipediaPageViews(keyword);
      
      if (wikipediaScore > 0) {
        console.log(`✓ Trend score for "${keyword}": ${wikipediaScore.toFixed(2)} (from Wikipedia)`);
        return wikipediaScore;
      }
      
      console.log(`No trend data found for "${keyword}", using score 0`);
      return 0;
    } catch (error) {
      console.error(`Error fetching trend for "${keyword}":`, error.message);
      return 0;
    }
  }

  /**
   * RAWG APIからトレンドスコアを取得（added数を使用）
   */
  async getRAWGTrendScore(keyword) {
    try {
      if (!this.rawgApiKey) {
        return 0;
      }
      
      const url = `https://api.rawg.io/api/games?key=${this.rawgApiKey}&search=${encodeURIComponent(keyword)}&page_size=5`;
      
      const response = await axios.get(url, { timeout: 10000 });
      
      if (!response.data || !response.data.results || response.data.results.length === 0) {
        return 0;
      }
      
      // 最も一致度が高いゲームのadded数を取得
      const topMatch = response.data.results[0];
      const addedCount = topMatch.added || 0;
      
      // 10点満点にスケール（100,000 added = 10点）
      return Math.min(addedCount / 10000, 10);
    } catch (error) {
      console.warn(`RAWG API error for "${keyword}":`, error.message);
      return 0;
    }
  }

  /**
   * Wikipedia ページビュー数を取得
   */
  async getWikipediaPageViews(keyword) {
    try {
      // 日付範囲（過去30日）
      const endDate = dayjs();
      const startDate = endDate.subtract(30, 'day');
      
      // 検索用のキーワードを整形（スペースをアンダースコアに）
      const searchTerm = this.formatWikipediaTitle(keyword);
      
      // Wikipedia英語版のページビュー数を取得
      const url = `${this.wikipediaBaseUrl}/per-article/en.wikipedia/all-access/user/${searchTerm}/daily/${startDate.format('YYYYMMDD')}/${endDate.format('YYYYMMDD')}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'GameEvaluator/1.0 (https://github.com/kyo10310415/game-evaluator; research purposes)',
          'Accept': 'application/json',
          'Api-User-Agent': 'GameEvaluator/1.0'
        },
        timeout: 10000
      });
      
      if (!response.data || !response.data.items || response.data.items.length === 0) {
        // 英語版で見つからない場合、日本語版も試す
        return await this.getWikipediaPageViewsJP(keyword);
      }
      
      // 過去30日間の合計ページビュー数を計算
      const totalViews = response.data.items.reduce((sum, item) => sum + item.views, 0);
      const averageDaily = totalViews / response.data.items.length;
      
      // 10点満点にスケール（10,000ビュー/日 = 10点）
      return Math.min(averageDaily / 1000, 10);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // 英語版で404の場合、日本語版を試す
        return await this.getWikipediaPageViewsJP(keyword);
      }
      console.warn(`Wikipedia API error for "${keyword}":`, error.message);
      return 0;
    }
  }

  /**
   * Wikipedia日本語版のページビュー数を取得
   */
  async getWikipediaPageViewsJP(keyword) {
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(30, 'day');
      
      const searchTerm = this.formatWikipediaTitle(keyword);
      
      const url = `${this.wikipediaBaseUrl}/per-article/ja.wikipedia/all-access/user/${searchTerm}/daily/${startDate.format('YYYYMMDD')}/${endDate.format('YYYYMMDD')}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'GameEvaluator/1.0 (https://github.com/kyo10310415/game-evaluator; research purposes)',
          'Accept': 'application/json',
          'Api-User-Agent': 'GameEvaluator/1.0'
        },
        timeout: 10000
      });
      
      if (!response.data || !response.data.items || response.data.items.length === 0) {
        return 0;
      }
      
      const totalViews = response.data.items.reduce((sum, item) => sum + item.views, 0);
      const averageDaily = totalViews / response.data.items.length;
      
      // 日本語版は閲覧数が少ないため、スケールを調整（5,000ビュー/日 = 10点）
      return Math.min(averageDaily / 500, 10);
    } catch (error) {
      console.warn(`Wikipedia JP API error for "${keyword}":`, error.message);
      return 0;
    }
  }

  /**
   * Reddit投稿数を取得
   */
  async getRedditMentions(keyword) {
    try {
      // ゲーム関連サブレディットで検索
      const subreddits = ['gaming', 'Games', 'pcgaming', 'PS5', 'NintendoSwitch', 'xbox'];
      
      // 過去30日間の投稿を検索
      const timestamp30DaysAgo = dayjs().subtract(30, 'day').unix();
      
      const url = `${this.redditBaseUrl}?q=${encodeURIComponent(keyword)}&sort=new&limit=100&t=month`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'GameEvaluator/1.0 (https://github.com/kyo10310415/game-evaluator; research purposes)',
          'Accept': 'application/json',
          'Api-User-Agent': 'GameEvaluator/1.0'
        },
        timeout: 10000
      });
      
      if (!response.data || !response.data.data || !response.data.data.children) {
        return 0;
      }
      
      // 投稿数とスコアを集計
      const posts = response.data.data.children;
      const relevantPosts = posts.filter(post => {
        const data = post.data;
        // 30日以内の投稿のみ
        return data.created_utc > timestamp30DaysAgo;
      });
      
      // スコアの合計（アップボート数）
      const totalScore = relevantPosts.reduce((sum, post) => sum + (post.data.score || 0), 0);
      
      // 10点満点にスケール（1000スコア = 10点）
      return Math.min(totalScore / 100, 10);
    } catch (error) {
      console.warn(`Reddit API error for "${keyword}":`, error.message);
      return 0;
    }
  }

  /**
   * Wikipedia検索用にタイトルをフォーマット
   */
  formatWikipediaTitle(title) {
    // スペースをアンダースコアに、特殊文字をエンコード
    let formatted = title.replace(/\s+/g, '_');
    
    // 括弧や記号を削除（Wikipediaタイトル形式に合わせる）
    formatted = formatted.replace(/[：:]/g, '_');
    formatted = formatted.replace(/[－–—-]/g, '_');
    
    return encodeURIComponent(formatted);
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
    
    return keywords.slice(0, 1); // 最大1つのキーワード（API負荷軽減）
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
      
      let totalScore = 0;
      let successCount = 0;
      
      for (const keyword of keywords) {
        const score = await this.getTrendScore(keyword);
        if (score > 0) {
          totalScore += score;
          successCount++;
        }
        
        // レート制限対策（Reddit API: 60リクエスト/分）
        await this.delay(1000);
      }
      
      if (successCount === 0) {
        return 0;
      }
      
      return totalScore / successCount; // 平均スコア
    } catch (error) {
      console.error('Error calculating game trend score:', error.message);
      return 0;
    }
  }

  /**
   * APIレート制限を考慮した待機
   */
  async delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AlternativeTrendsCollector;
