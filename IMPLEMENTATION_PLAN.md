# 未実装機能の実装計画

## 🎯 優先度：高

### 1. Steam APIでアップデート情報取得

**目的**: コンシューマーゲームのパッチノート・アップデート情報取得

**実装方法**:
```javascript
// src/collectors/steam-collector.js
import axios from 'axios';

export class SteamCollector {
  async getRecentUpdates() {
    // Steam News APIを使用
    const response = await axios.get('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/', {
      params: {
        appid: 'GAME_APP_ID',
        count: 10,
        maxlength: 300,
        format: 'json'
      }
    });
    
    return response.data.appnews.newsitems;
  }
}
```

**必要な作業**:
1. Steam APIキー取得（無料）
2. `src/collectors/steam-collector.js` 作成
3. `scripts/collect-and-evaluate.js` に統合
4. `game_updates` テーブルへの保存処理

**所要時間**: 約2〜3時間

---

### 2. ソーシャルゲーム専用データソース追加

**目的**: ソシャゲのリリース・アップデート情報を正確に取得

**実装方法**:
1. **Game-i API** (日本のソシャゲセールスランキング)
   - URL: https://game-i.daa.jp/
   - 特徴: 日本のソシャゲに特化

2. **Google Play Store API** (非公式)
   - NPMパッケージ: `google-play-scraper`
   - 新作＆アップデート情報取得可能

```javascript
// src/collectors/social-game-collector.js
import gplay from 'google-play-scraper';

export class SocialGameCollector {
  async getNewReleases() {
    const apps = await gplay.list({
      category: gplay.category.GAME,
      collection: gplay.collection.NEW_FREE,
      num: 50
    });
    
    return apps.filter(app => app.genre === 'Role Playing' || app.genre === 'Strategy');
  }
}
```

**必要な作業**:
1. `google-play-scraper` インストール
2. `src/collectors/social-game-collector.js` 作成
3. データベーススキーマ拡張（ストア情報追加）

**所要時間**: 約3〜4時間

---

## 🎯 優先度：中

### 3. セールスランキングデータ統合

**データソース**:
1. **Steam Top Sellers** (コンシューマー)
   - API: https://store.steampowered.com/api/featured/
   
2. **Game-i ランキング** (ソシャゲ)
   - スクレイピング: https://game-i.daa.jp/rank/

**実装方法**:
```javascript
// src/collectors/sales-collector.js
export class SalesCollector {
  async getSteamTopSellers() {
    const response = await axios.get('https://store.steampowered.com/api/featured/');
    return response.data.top_sellers;
  }
  
  async getGameiRanking() {
    // Puppeteerでスクレイピング
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://game-i.daa.jp/rank/');
    
    const rankings = await page.evaluate(() => {
      // ランキングデータ抽出
    });
    
    return rankings;
  }
}
```

**所要時間**: 約4〜5時間

---

### 4. 日本ゲームメディアからのスクレイピング

**対象サイト**:
- 4Gamer.net
- Game*Spark
- 電撃オンライン

**実装方法**:
```javascript
// src/collectors/japanese-media-scraper.js
import axios from 'axios';
import * as cheerio from 'cheerio';

export class JapaneseMediaScraper {
  async scrape4Gamer() {
    const response = await axios.get('https://www.4gamer.net/games/999/G999905/');
    const $ = cheerio.load(response.data);
    
    const articles = [];
    $('.article').each((i, elem) => {
      articles.push({
        title: $(elem).find('.title').text(),
        url: $(elem).find('a').attr('href'),
        date: $(elem).find('.date').text()
      });
    });
    
    return articles;
  }
}
```

**注意事項**:
- robots.txt遵守
- アクセス頻度制限（3秒以上間隔）
- User-Agent設定

**所要時間**: 約5〜6時間

---

## 🎯 優先度：低

### 5. リアルタイムSNS監視

**データソース**:
- X (Twitter) API v2
- YouTube Data API

**制限事項**:
- X API: 有料プラン必要（Basic $100/月）
- YouTube API: 無料枠10,000 units/日

**所要時間**: 約6〜8時間

---

## 📅 実装スケジュール案

| 機能 | 優先度 | 所要時間 | 依存関係 |
|------|--------|---------|---------|
| Steam アップデート | 高 | 2〜3h | なし |
| ソシャゲデータソース | 高 | 3〜4h | なし |
| セールスランキング | 中 | 4〜5h | Steam/Game-i API |
| 日本メディアスクレイピング | 中 | 5〜6h | なし |
| SNS監視 | 低 | 6〜8h | 有料API契約 |

**合計所要時間**: 約20〜26時間

---

## 💰 追加コスト見積もり

| サービス | 月額料金 | 備考 |
|---------|---------|------|
| Steam API | 無料 | 制限なし |
| Google Play Scraper | 無料 | 非公式、制限あり |
| Game-i | 無料 | スクレイピング（要注意） |
| X API Basic | $100 | リアルタイム監視に必要 |
| YouTube Data API | 無料 | 10,000 units/日まで |

**推奨プラン**: Steam API + Google Play Scraper（無料）

---

最終更新日: 2025-12-12
