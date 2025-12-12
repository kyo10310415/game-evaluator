import axios from 'axios';
import dayjs from 'dayjs';
import dotenv from 'dotenv';

dotenv.config();

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';

/**
 * RAWG APIからゲーム情報を取得
 */
export class RawgCollector {
  constructor() {
    this.apiKey = RAWG_API_KEY;
    this.baseUrl = RAWG_BASE_URL;
  }

  /**
   * 今後1ヶ月以内にリリース予定のゲームを取得
   */
  async getUpcomingGames(platforms = 'pc,playstation5,xbox-series-x,nintendo-switch') {
    try {
      const today = dayjs();
      const oneMonthLater = today.add(1, 'month');
      
      console.log(`Fetching upcoming games from RAWG (${today.format('YYYY-MM-DD')} to ${oneMonthLater.format('YYYY-MM-DD')})...`);
      
      const response = await axios.get(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          dates: `${today.format('YYYY-MM-DD')},${oneMonthLater.format('YYYY-MM-DD')}`,
          platforms: platforms,
          ordering: '-added',
          page_size: 40
        }
      });
      
      const games = response.data.results.map(game => this.formatGameData(game));
      console.log(`✓ Found ${games.length} upcoming games`);
      
      return games;
    } catch (error) {
      console.error('Error fetching upcoming games from RAWG:', error.message);
      return [];
    }
  }

  /**
   * 過去1週間以内にリリースされたゲームを取得
   */
  async getRecentlyReleasedGames(platforms = 'pc,playstation5,xbox-series-x,nintendo-switch') {
    try {
      const today = dayjs();
      const oneWeekAgo = today.subtract(7, 'day');
      
      console.log(`Fetching recently released games from RAWG (${oneWeekAgo.format('YYYY-MM-DD')} to ${today.format('YYYY-MM-DD')})...`);
      
      const response = await axios.get(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          dates: `${oneWeekAgo.format('YYYY-MM-DD')},${today.format('YYYY-MM-DD')}`,
          platforms: platforms,
          ordering: '-released',
          page_size: 40
        }
      });
      
      const games = response.data.results.map(game => this.formatGameData(game));
      console.log(`✓ Found ${games.length} recently released games`);
      
      return games;
    } catch (error) {
      console.error('Error fetching recently released games from RAWG:', error.message);
      return [];
    }
  }

  /**
   * ゲームの詳細情報を取得
   */
  async getGameDetails(gameId) {
    try {
      const response = await axios.get(`${this.baseUrl}/games/${gameId}`, {
        params: {
          key: this.apiKey
        }
      });
      
      return this.formatGameData(response.data);
    } catch (error) {
      console.error(`Error fetching game details for ID ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * ゲームデータをフォーマット
   */
  formatGameData(rawData) {
    return {
      title: rawData.name,
      game_type: 'consumer', // RAWGは主にコンシューマーゲーム
      release_date: rawData.released,
      developer: rawData.developers?.map(d => d.name).join(', ') || null,
      publisher: rawData.publishers?.map(p => p.name).join(', ') || null,
      platforms: rawData.platforms?.map(p => p.platform.name) || [],
      description: rawData.description_raw || rawData.description || null,
      image_url: rawData.background_image,
      source_url: `https://rawg.io/games/${rawData.slug}`,
      rawg_id: rawData.id,
      metacritic_score: rawData.metacritic,
      rating: rawData.rating,
      genres: rawData.genres?.map(g => g.name) || [],
      tags: rawData.tags?.slice(0, 10).map(t => t.name) || []
    };
  }

  /**
   * APIレート制限を考慮した待機
   */
  async delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RawgCollector;
