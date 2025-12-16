import axios from 'axios';
import dayjs from 'dayjs';

/**
 * Steam APIからアップデート情報を取得
 */
export class SteamCollector {
  constructor() {
    this.baseUrl = 'https://api.steampowered.com';
    this.storeUrl = 'https://store.steampowered.com/api';
  }

  /**
   * 人気ゲームのApp IDリスト（定期更新推奨）
   */
  getPopularGameAppIds() {
    return [
      // トップセラー・人気タイトル
      730,    // CS:GO
      570,    // Dota 2
      1172470, // Apex Legends
      1517290, // Battlefield 2042
      2519060, // Helldivers 2
      2357570, // Tekken 8
      1623730, // Palworld
      1086940, // Baldur's Gate 3
      2358720, // Black Myth: Wukong
      1091500, // Cyberpunk 2077
      413150,  // Stardew Valley
      1245620, // Elden Ring
      2166140, // Horizon Forbidden West
      1174180, // Red Dead Redemption 2
      1938090  // Call of Duty
    ];
  }

  /**
   * 最近のゲームアップデート情報を取得
   */
  async getRecentUpdates(daysAgo = 7) {
    try {
      const appIds = this.getPopularGameAppIds();
      const updates = [];
      
      console.log(`Fetching Steam updates for ${appIds.length} popular games...`);
      
      for (const appId of appIds) {
        try {
          const gameUpdates = await this.getGameUpdates(appId, daysAgo);
          if (gameUpdates && gameUpdates.length > 0) {
            updates.push(...gameUpdates);
          }
          
          // レート制限対策
          await this.delay(500);
        } catch (error) {
          console.error(`Error fetching updates for Steam App ${appId}:`, error.message);
        }
      }
      
      console.log(`✓ Found ${updates.length} Steam updates`);
      return updates;
    } catch (error) {
      console.error('Error fetching Steam updates:', error.message);
      return [];
    }
  }

  /**
   * 特定ゲームのアップデート情報を取得
   */
  async getGameUpdates(appId, daysAgo = 7) {
    try {
      // ゲーム情報を取得
      const gameInfo = await this.getGameInfo(appId);
      if (!gameInfo) {
        return [];
      }

      // ニュース・アップデート情報を取得
      const response = await axios.get(`${this.baseUrl}/ISteamNews/GetNewsForApp/v2/`, {
        params: {
          appid: appId,
          count: 10,
          maxlength: 500,
          format: 'json'
        }
      });

      if (!response.data?.appnews?.newsitems) {
        return [];
      }

      const cutoffDate = dayjs().subtract(daysAgo, 'day').unix();
      const updates = response.data.appnews.newsitems
        .filter(item => {
          // 指定日数以内のアップデート情報のみ
          if (item.date < cutoffDate) return false;
          
          // アップデート関連のニュースのみ
          const title = item.title.toLowerCase();
          return title.includes('update') || 
                 title.includes('patch') || 
                 title.includes('hotfix') ||
                 title.includes('アップデート') ||
                 title.includes('パッチ');
        })
        .map(item => this.formatUpdateData(item, gameInfo));

      return updates;
    } catch (error) {
      console.error(`Error fetching game updates for App ${appId}:`, error.message);
      return [];
    }
  }

  /**
   * ゲーム基本情報を取得
   */
  async getGameInfo(appId) {
    try {
      const response = await axios.get(`${this.storeUrl}/appdetails`, {
        params: {
          appids: appId,
          l: 'japanese'
        }
      });

      const data = response.data[appId];
      if (!data || !data.success) {
        return null;
      }

      return {
        appId: appId,
        title: data.data.name,
        developer: data.data.developers?.join(', '),
        publisher: data.data.publishers?.join(', '),
        image_url: data.data.header_image,
        steam_url: `https://store.steampowered.com/app/${appId}`
      };
    } catch (error) {
      console.error(`Error fetching game info for App ${appId}:`, error.message);
      return null;
    }
  }

  /**
   * アップデートデータをフォーマット
   */
  formatUpdateData(newsItem, gameInfo) {
    return {
      title: gameInfo.title,
      game_type: 'consumer',
      update_title: newsItem.title,
      update_date: dayjs.unix(newsItem.date).format('YYYY-MM-DD'),
      description: this.cleanDescription(newsItem.contents),
      version: this.extractVersion(newsItem.title),
      developer: gameInfo.developer,
      publisher: gameInfo.publisher,
      image_url: gameInfo.image_url,
      source_url: newsItem.url || gameInfo.steam_url,
      steam_app_id: gameInfo.appId,
      platforms: ['PC']
    };
  }

  /**
   * 説明文をクリーンアップ
   */
  cleanDescription(text) {
    if (!text) return null;
    
    // HTMLタグを削除
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // 改行を整理
    cleaned = cleaned.replace(/\n+/g, ' ').trim();
    
    // 最大500文字に制限
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 497) + '...';
    }
    
    return cleaned;
  }

  /**
   * バージョン番号を抽出
   */
  extractVersion(title) {
    // "Update 1.2.3" や "Patch v1.0" などからバージョンを抽出
    const versionMatch = title.match(/v?(\d+\.[\d.]+)/i);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * 待機処理
   */
  async delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SteamCollector;
