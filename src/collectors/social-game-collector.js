import gplay from 'google-play-scraper';
import dayjs from 'dayjs';

/**
 * Google Play StoreからソーシャルゲームRPG情報を取得
 */
export class SocialGameCollector {
  constructor() {
    this.targetGenres = [
      gplay.category.GAME_ROLE_PLAYING,
      gplay.category.GAME_STRATEGY,
      gplay.category.GAME_CARD,
      gplay.category.GAME_SIMULATION
    ];
  }

  /**
   * 新作ソーシャルゲームを取得
   */
  async getNewReleases(limit = 30) {
    try {
      console.log('Fetching new social games from Google Play...');
      const allGames = [];

      for (const category of this.targetGenres) {
        try {
          console.log(`Fetching category: ${category}`);
          const games = await gplay.list({
            category: category,
            collection: gplay.collection.NEW_FREE,
            num: 20,
            lang: 'ja',
            country: 'jp'
          });

          const filtered = games
            .filter(game => this.isSocialGame(game))
            .map(game => this.formatGameData(game, 'new_release'))
            .filter(game => game !== null);

          allGames.push(...filtered);
          
          // レート制限対策
          await this.delay(1000);
        } catch (error) {
          console.error(`Error fetching games for category ${category}:`, error.message);
        }
      }

      // 重複削除（appIdで判定）
      const uniqueGames = this.removeDuplicates(allGames);
      
      console.log(`✓ Found ${uniqueGames.length} new social games`);
      return uniqueGames.slice(0, limit);
    } catch (error) {
      console.error('Error fetching new social games:', error.message);
      return [];
    }
  }

  /**
   * 最近アップデートされたソーシャルゲームを取得
   */
  async getRecentlyUpdated(limit = 30, daysAgo = 7) {
    try {
      console.log('Fetching recently updated social games from Google Play...');
      const allGames = [];
      const cutoffDate = dayjs().subtract(daysAgo, 'day');

      for (const category of this.targetGenres) {
        try {
          const games = await gplay.list({
            category: category,
            collection: gplay.collection.TOP_FREE,
            num: 50,
            lang: 'ja',
            country: 'jp'
          });

          // 詳細情報を取得してアップデート日をチェック
          for (const game of games) {
            try {
              if (!game.appId) {
                console.warn('Game missing appId, skipping:', game.title);
                continue;
              }
              
              const details = await gplay.app({ appId: game.appId });
              
              if (!details || typeof details !== 'object') {
                console.warn(`Failed to fetch valid details for ${game.appId}, skipping`);
                continue;
              }
              
              if (!details.updated) {
                console.warn(`No update info for ${game.appId}, skipping`);
                continue;
              }
              
              const updateDate = dayjs(details.updated);
              if (updateDate.isAfter(cutoffDate)) {
                const formattedGame = this.formatGameData(details, 'update');
                
                if (!formattedGame) {
                  console.warn(`Failed to format game data for ${game.appId}, skipping`);
                  continue;
                }
                
                formattedGame.update_date = updateDate.format('YYYY-MM-DD');
                formattedGame.version = details.version;
                
                if (this.isSocialGame(details)) {
                  allGames.push(formattedGame);
                }
              }
              
              // レート制限対策
              await this.delay(500);
            } catch (error) {
              console.error(`Error fetching details for ${game.appId}:`, error.message);
            }
          }
          
          await this.delay(1000);
        } catch (error) {
          console.error(`Error fetching updated games for category ${category}:`, error.message);
        }
      }

      const uniqueGames = this.removeDuplicates(allGames);
      
      console.log(`✓ Found ${uniqueGames.length} recently updated social games`);
      return uniqueGames.slice(0, limit);
    } catch (error) {
      console.error('Error fetching recently updated social games:', error.message);
      return [];
    }
  }

  /**
   * ソーシャルゲーム判定（課金要素、オンライン要素があるか）
   */
  isSocialGame(game) {
    if (!game) return false;

    // 安全な文字列変換
    const safeString = (value) => {
      if (!value) return '';
      if (Array.isArray(value)) return value.join(' ');
      return String(value);
    };
    
    const title = safeString(game.title).toLowerCase();
    const description = safeString(game.description).toLowerCase();
    
    // ソシャゲの特徴キーワード
    const socialKeywords = [
      'rpg', 'mmorpg', 'ガチャ', 'gacha', 
      'オンライン', 'online', 'マルチプレイ', 'multiplayer',
      'pvp', 'ギルド', 'guild', 'レイド', 'raid',
      'コレクション', 'collection', '育成', 'training',
      'デッキ', 'deck', 'カード', 'card'
    ];

    // 除外キーワード（買い切りゲームなど）
    const excludeKeywords = [
      'offline', 'オフライン', 'single player', 'シングルプレイ'
    ];

    const hasExclude = excludeKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword)
    );

    if (hasExclude) return false;

    const hasSocial = socialKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword)
    );

    // 無料 & ソシャゲキーワードあり
    return game.free && hasSocial;
  }

  /**
   * ゲームデータをフォーマット
   */
  formatGameData(game, type = 'new_release') {
    if (!game) {
      console.warn('formatGameData called with null/undefined game');
      return null;
    }
    
    // 日付を正規化（YYYY-MM-DD形式に変換）
    const normalizeDate = (dateValue) => {
      if (!dateValue) return null;
      try {
        // ミリ秒タイムスタンプの場合
        if (typeof dateValue === 'number' && dateValue > 1000000000000) {
          return dayjs(dateValue).format('YYYY-MM-DD');
        }
        // 文字列の場合
        const parsed = dayjs(dateValue);
        return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
      } catch (e) {
        console.warn(`Invalid date format: ${dateValue}`);
        return null;
      }
    };
    
    // 配列を安全に文字列に変換
    const safeArrayToString = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : null;
      }
      return String(value);
    };
    
    // スクリーンショットを安全に取得
    const getFirstScreenshot = () => {
      try {
        if (game.screenshots && Array.isArray(game.screenshots) && game.screenshots.length > 0) {
          return game.screenshots[0];
        }
        return null;
      } catch (e) {
        return null;
      }
    };
    
    return {
      title: game.title || 'Unknown',
      game_type: 'social',
      release_date: normalizeDate(game.released || game.updated),
      update_date: type === 'update' ? normalizeDate(game.updated) : null,
      developer: game.developer || 'Unknown',
      publisher: game.developer || 'Unknown', // Google Playにpublisher情報がないため
      description: this.cleanDescription(game.description),
      image_url: game.icon || getFirstScreenshot() || null,
      source_url: game.url || `https://play.google.com/store/apps/details?id=${game.appId}`,
      google_play_id: game.appId || null,
      rating: game.score || null,
      platforms: ['Android'],
      version: game.version || null,
      installs: safeArrayToString(game.installs),
      genre: safeArrayToString(game.genre)
    };
  }

  /**
   * 説明文をクリーンアップ
   */
  cleanDescription(text) {
    try {
      if (!text) return null;
      
      // 安全な文字列変換
      const safeText = String(text);
      
      // HTMLタグを削除
      let cleaned = safeText.replace(/<[^>]*>/g, '');
      
      // 改行を整理
      cleaned = cleaned.replace(/\n+/g, ' ').trim();
      
      // 最大500文字に制限
      if (cleaned && typeof cleaned === 'string' && cleaned.length > 500) {
        cleaned = cleaned.substring(0, 497) + '...';
      }
      
      return cleaned || null;
    } catch (error) {
      console.error('Error in cleanDescription:', error.message);
      return null;
    }
  }

  /**
   * 重複削除
   */
  removeDuplicates(games) {
    const seen = new Set();
    return games.filter(game => {
      const id = game.google_play_id;
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  /**
   * 待機処理
   */
  async delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SocialGameCollector;
