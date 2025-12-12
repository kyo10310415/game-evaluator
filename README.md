# ゲームリリース評価システム

新発売・アップデートのゲーム情報を自動収集し、AIで評価してランキング表示するシステム

## 🎮 主な機能

### 完成している機能
- ✅ RAWG APIからコンシューマーゲーム情報の自動取得
- ✅ Google Trends APIによるトレンド分析
- ✅ OpenAI APIを使ったゲーム評価（10段階評価）
- ✅ PostgreSQLデータベースへのデータ保存
- ✅ Web画面でのランキング表示
- ✅ Slack通知機能
- ✅ GitHub Actionsによる週次自動実行
- ✅ 手動実行機能

### 未実装の機能
- ⏳ Webスクレイピング機能（4Gamer、ファミ通等）
- ⏳ ソーシャルゲーム情報の収集
- ⏳ アップデート情報の収集
- ⏳ より詳細なトレンド分析

## 📊 機能エントリポイント（URI）

### Web表示
- **トップページ**: `GET /`
  - ランキングを表示するメイン画面

### API エンドポイント
- **最新ランキング取得**: `GET /api/rankings/latest`
  - クエリパラメータ:
    - `type`: `consumer` | `social` | 省略（全て）
    - `limit`: 取得件数（デフォルト: 50）
  
- **指定日ランキング取得**: `GET /api/rankings/:date`
  - パラメータ: `date` (YYYY-MM-DD形式)
  - クエリパラメータ: 上記と同じ

- **スコア分布取得**: `GET /api/stats/distribution`

- **ヘルスチェック**: `GET /api/health`

### スクリプト実行
- **データ収集・評価実行**: `npm run collect`
- **マイグレーション実行**: `npm run migrate`

## 🗄️ データアーキテクチャ

### データモデル
1. **games**: ゲーム基本情報
   - タイトル、リリース日、開発元、プラットフォーム等

2. **game_updates**: アップデート情報
   - ゲームID、アップデート日、バージョン等

3. **evaluations**: AI評価結果
   - スコア（1-10）、トレンドスコア、ブランドスコア等

4. **trend_data**: トレンドデータ
   - Google Trendsから取得したキーワード別のトレンド値

5. **notification_history**: 通知履歴

### 使用しているストレージサービス
- **PostgreSQL**: Render.com提供のマネージドPostgreSQL（無料プラン）

### データフロー
```
[RAWG API] → [Data Collection] → [PostgreSQL]
[Google Trends] ↗                      ↓
                                  [AI Evaluation]
                                       ↓
                                  [PostgreSQL]
                                       ↓
                              [Web表示 / Slack通知]
```

## 📝 評価基準

### コンシューマーゲーム（10段階）
1. **トレンドスコア**: X、YouTube、SNSでの話題性
2. **ブランドスコア**: 有名メーカー（任天堂、カプコン等）
3. **シリーズスコア**: 人気タイトルのシリーズ・続編
4. **売上スコア**: Metacriticスコア、レビュー評価

### ソーシャルゲーム（10段階）
1. **トレンドスコア**: X、YouTube、SNSでの話題性
2. **ブランドスコア**: 有名メーカー（Cygames等）や有名IP
3. **シリーズスコア**: 人気タイトルのシリーズ・続編
4. **売上スコア**: セールスランキング、ユーザー評価

## 🚀 デプロイ方法

### 1. Render.comでのデプロイ

#### 前提条件
- GitHub リポジトリ
- Render.com アカウント
- 各種APIキー

#### 手順

1. **GitHubリポジトリに接続**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/game-evaluator.git
   git push -u origin main
   ```

2. **Render.comで新規サービス作成**
   - Dashboard → New → Blueprint
   - GitHubリポジトリを接続
   - `render.yaml` が自動検出される
   - Apply をクリック

3. **環境変数の設定**
   - Render Dashboard → サービス選択 → Environment
   - 以下の環境変数を設定:
     - `RAWG_API_KEY`: RAWG APIキー
     - `OPENAI_API_KEY`: OpenAI APIキー
     - `SLACK_WEBHOOK_URL`: Slack Webhook URL
     - `DATABASE_URL`: 自動設定される

4. **マイグレーション実行**
   - Render Shell で実行:
   ```bash
   npm run migrate
   ```

### 2. GitHub Actionsの設定

#### GitHubシークレットの設定
Settings → Secrets and variables → Actions → New repository secret

必要なシークレット:
- `DATABASE_URL`: Render.comのPostgreSQL接続URL
- `RAWG_API_KEY`: RAWG APIキー
- `OPENAI_API_KEY`: OpenAI APIキー
- `SLACK_WEBHOOK_URL`: Slack Webhook URL

#### 自動実行スケジュール
- 毎週月曜日 午前9時（日本時間）に自動実行
- Actionsタブから手動実行も可能

## 🔧 ローカル開発

### セットアップ
```bash
# 依存関係をインストール
npm install

# .envファイルを作成
cp .env.example .env
# .envファイルを編集して各APIキーを設定

# データベースマイグレーション
npm run migrate

# 開発サーバー起動
npm run dev
```

### 手動でデータ収集・評価実行
```bash
npm run collect
```

### ローカルデータベース
ローカル開発にはPostgreSQLが必要です。

```bash
# PostgreSQLインストール（macOS）
brew install postgresql
brew services start postgresql

# データベース作成
createdb game_evaluator

# .envにローカルDB URLを設定
DATABASE_URL=postgresql://localhost:5432/game_evaluator
```

## 📦 技術スタック

- **バックエンド**: Node.js, Express
- **データベース**: PostgreSQL
- **AI評価**: OpenAI GPT-4o-mini
- **ゲーム情報**: RAWG Video Games Database API
- **トレンド分析**: Google Trends API
- **通知**: Slack Incoming Webhooks
- **自動実行**: GitHub Actions
- **デプロイ**: Render.com

## 🔑 必要なAPIキー

### 1. RAWG API
- URL: https://rawg.io/apidocs
- 無料枠: 20,000リクエスト/月

### 2. OpenAI API
- URL: https://platform.openai.com/
- 従量課金（GPT-4o-mini使用）

### 3. Slack Webhook
- Slackワークスペースで作成
- URL: https://api.slack.com/apps

### 4. Google Trends API
- APIキー不要（ライブラリで直接アクセス）

## 📈 今後の開発予定

1. **Webスクレイピング実装**
   - 4Gamer.net、ファミ通等からの情報収集
   - 利用規約遵守、適切なレート制限

2. **ソーシャルゲーム対応**
   - ソシャゲ専門サイトからの情報収集
   - App Store/Google Playランキング連携

3. **アップデート情報の収集**
   - ゲームの大型アップデート情報
   - パッチノート解析

4. **UI/UX改善**
   - グラフ表示（Chart.js）
   - フィルタリング機能強化
   - 検索機能

5. **通知機能拡張**
   - Discord対応
   - メール通知

## 📄 ライセンス

MIT License

## 👨‍💻 開発者向けメモ

### デバッグ
```bash
# ログ確認（Render）
Render Dashboard → Logs

# ローカルでのテスト実行
NODE_ENV=development npm run collect
```

### データベースクエリ
```bash
# Render Shellで直接PostgreSQLに接続
psql $DATABASE_URL
```

---

**最終更新日**: 2024-12-12
**ステータス**: ✅ 基本機能実装完了、Web表示対応
