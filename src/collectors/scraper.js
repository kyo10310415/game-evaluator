import axios from 'axios';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';

/**
 * Webスクレイピングによるゲーム情報収集
 * 注意: 利用規約を遵守し、適切な遅延を設定
 */
export class GameScraper {
  constructor() {
    this.delay_ms = parseInt(process.env.SCRAPING_DELAY_MS) || 1000;
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  /**
   * 4Gamer.netから新作ゲーム情報を取得
   * 注意: 実際の運用前にrobots.txtと利用規約を確認すること
   */
  async scrape4GamerReleases() {
    try {
      console.log('Scraping 4Gamer.net for game releases...');
      
      // 4Gamerのリリースカレンダーページ（例）
      // 実際のURLは最新のサイト構造に合わせて調整が必要
      const url = 'https://www.4gamer.net/games/000/G000000/release/';
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const games = [];
      
      // サンプル: HTML構造に合わせてセレクタを調整する必要あり
      // これはプレースホルダーの実装
      $('.release-item').each((index, element) => {
        const title = $(element).find('.title').text().trim();
        const releaseDate = $(element).find('.date').text().trim();
        const platform = $(element).find('.platform').text().trim();
        const link = $(element).find('a').attr('href');
        
        if (title) {
          games.push({
            title,
            release_date: this.parseJapaneseDate(releaseDate),
            platforms: [platform],
            source_url: link ? `https://www.4gamer.net${link}` : null,
            game_type: 'consumer',
            source: '4Gamer'
          });
        }
      });
      
      console.log(`✓ Scraped ${games.length} games from 4Gamer`);
      
      return games;
    } catch (error) {
      console.error('Error scraping 4Gamer:', error.message);
      return [];
    }
  }

  /**
   * ファミ通から新作ゲーム情報を取得（プレースホルダー）
   */
  async scrapeFamitsuReleases() {
    try {
      console.log('Scraping Famitsu for game releases...');
      
      // プレースホルダー実装
      // 実際の運用には適切なURL、セレクタ、利用規約の確認が必要
      
      await this.delay();
      
      console.log('✓ Famitsu scraping completed (placeholder)');
      
      return [];
    } catch (error) {
      console.error('Error scraping Famitsu:', error.message);
      return [];
    }
  }

  /**
   * ソーシャルゲーム情報を取得（プレースホルダー）
   */
  async scrapeSocialGameUpdates() {
    try {
      console.log('Scraping social game updates...');
      
      // プレースホルダー実装
      // 実際の運用には適切なソース、API、利用規約の確認が必要
      
      await this.delay();
      
      console.log('✓ Social game scraping completed (placeholder)');
      
      return [];
    } catch (error) {
      console.error('Error scraping social games:', error.message);
      return [];
    }
  }

  /**
   * すべてのソースから情報を収集
   */
  async scrapeAllSources() {
    const allGames = [];
    
    // 各ソースから順次取得（レート制限対策）
    const sources = [
      this.scrape4GamerReleases.bind(this),
      this.scrapeFamitsuReleases.bind(this),
      this.scrapeSocialGameUpdates.bind(this)
    ];
    
    for (const scrapeFunc of sources) {
      try {
        const games = await scrapeFunc();
        allGames.push(...games);
        await this.delay();
      } catch (error) {
        console.error('Error in scraping source:', error.message);
      }
    }
    
    return this.deduplicateGames(allGames);
  }

  /**
   * 日本語の日付を解析（例: 2024年12月15日）
   */
  parseJapaneseDate(dateStr) {
    try {
      // "2024年12月15日" -> "2024-12-15"
      const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (match) {
        const [, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // その他のフォーマット対応
      const parsed = dayjs(dateStr);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 重複ゲームを除去
   */
  deduplicateGames(games) {
    const seen = new Map();
    
    games.forEach(game => {
      const key = `${game.title}_${game.release_date}`;
      if (!seen.has(key)) {
        seen.set(key, game);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * スクレイピング遅延
   */
  async delay(ms = this.delay_ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * リトライ機能付きHTTPリクエスト
   */
  async fetchWithRetry(url, options = {}, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, options);
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        console.log(`Retry ${i + 1}/${retries} for ${url}`);
        await this.delay(2000 * (i + 1));
      }
    }
  }
}

export default GameScraper;
