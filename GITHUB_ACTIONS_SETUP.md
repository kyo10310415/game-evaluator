# GitHub Actions 設定手順

## ⚠️ 重要な注意

GitHub Appの権限制限により、ワークフローファイルは**GitHubのWebインターフェースから直接追加**する必要があります。

---

## 📝 Step 1: ワークフローファイルを手動作成

### 1.1 GitHubリポジトリにアクセス

https://github.com/kyo10310415/game-evaluator

### 1.2 ワークフローファイルを作成

1. リポジトリのトップページで「Add file」→「Create new file」をクリック
2. ファイル名に以下を入力:
   ```
   .github/workflows/weekly-evaluation.yml
   ```
3. 以下の内容を貼り付け:

```yaml
name: Weekly Game Evaluation

on:
  # 毎週月曜日 午前9時（日本時間）に実行
  schedule:
    - cron: '0 0 * * 1'  # UTC 0:00 月曜日 = JST 9:00 月曜日
  
  # 手動実行も可能
  workflow_dispatch:

jobs:
  evaluate-games:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run migrate
      
      - name: Collect and evaluate games
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          RAWG_API_KEY: ${{ secrets.RAWG_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          NODE_ENV: production
        run: npm run collect
      
      - name: Notify on failure
        if: failure()
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          curl -X POST $SLACK_WEBHOOK_URL \
            -H 'Content-Type: application/json' \
            -d '{"text":"❌ ゲーム評価の自動実行が失敗しました"}'
```

4. 「Commit new file」をクリック

---

## 🔑 Step 2: GitHubシークレットの設定

### 2.1 シークレット設定ページにアクセス

1. リポジトリページで「Settings」タブをクリック
2. 左メニューの「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック

### 2.2 必要なシークレットを追加

以下の4つのシークレットを追加してください:

#### 1. DATABASE_URL

- **Name**: `DATABASE_URL`
- **Secret**: Render.comのPostgreSQL接続URL
  - Render Dashboard → データベース選択 → 「Info」タブ → 「Internal Database URL」をコピー
  - 例: `postgresql://user:password@hostname:5432/database_name`

#### 2. RAWG_API_KEY

- **Name**: `RAWG_API_KEY`
- **Secret**: 取得したRAWG APIキー

#### 3. OPENAI_API_KEY

- **Name**: `OPENAI_API_KEY`
- **Secret**: 取得したOpenAI APIキー

#### 4. SLACK_WEBHOOK_URL

- **Name**: `SLACK_WEBHOOK_URL`
- **Secret**: 取得したSlack Webhook URL

---

## ✅ Step 3: 動作確認

### 3.1 手動実行でテスト

1. リポジトリの「Actions」タブをクリック
2. 左メニューから「Weekly Game Evaluation」を選択
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」を再度クリックして実行

### 3.2 実行ログを確認

- ワークフローが正常に実行されることを確認
- 各ステップのログを確認
- エラーがある場合は、シークレットの設定を確認

---

## 🕐 自動実行スケジュール

ワークフローは以下のスケジュールで自動実行されます:

- **毎週月曜日 午前9時（日本時間）**
- UTC 0:00 = JST 9:00

手動実行も可能:
- Actionsタブ → Weekly Game Evaluation → Run workflow

---

## 🔧 トラブルシューティング

### ワークフローが失敗する

**確認事項:**
1. すべてのシークレットが正しく設定されているか
2. DATABASE_URLが正しいか（Internal Database URLを使用）
3. 各APIキーが有効か
4. Render.comのデータベースが起動しているか

### データベース接続エラー

**解決方法:**
- Render.com Dashboard → データベース → 「Info」タブ
- 「Internal Database URL」を再度コピー
- GitHubシークレットの`DATABASE_URL`を更新

---

## 📊 実行後の確認

ワークフロー実行後:

1. **Slack通知を確認**
   - ランキング通知が届いていることを確認

2. **Webサイトを確認**
   - Render.comのWebサービスURLにアクセス
   - ランキングが表示されることを確認

3. **ログを確認**
   - Actions タブでワークフローのログを確認
   - エラーがないことを確認

---

## ✨ 完了！

GitHub Actionsの設定が完了しました。

- ✅ 毎週月曜日午前9時に自動実行
- ✅ 手動実行も可能
- ✅ エラー時はSlack通知

次は **Render.comへのデプロイ** に進んでください！
