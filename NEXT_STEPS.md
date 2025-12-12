# 🎯 次のステップ

GitHubへのプッシュが完了しました！次はRender.comへのデプロイです。

---

## ✅ 完了した作業

- ✅ プロジェクトコードの作成
- ✅ Gitリポジトリの初期化
- ✅ GitHubへのプッシュ完了
  - リポジトリURL: https://github.com/kyo10310415/game-evaluator

---

## 🚀 次に実施すること

### 1️⃣ APIキーの取得（まだの場合）

#### RAWG API Key
1. https://rawg.io/apidocs にアクセス
2. 「Get API Key」から登録
3. APIキーをメモ

#### OpenAI API Key
1. https://platform.openai.com/ にログイン
2. 左メニュー「API keys」→「Create new secret key」
3. APIキーをメモ（2度と表示されないので注意！）

#### Slack Webhook URL
1. https://api.slack.com/apps にアクセス
2. 「Create New App」→「From scratch」
3. 「Incoming Webhooks」を有効化
4. Webhook URLをメモ

---

### 2️⃣ Render.comでのデプロイ

#### Step 1: Render.comにログイン

https://render.com/ にアクセスしてログイン

#### Step 2: Blueprintでデプロイ

1. ダッシュボードで「New +」→「Blueprint」
2. 「Connect a repository」をクリック
3. `kyo10310415/game-evaluator` を選択
4. `render.yaml` が自動検出される
5. 「Apply」をクリック

**自動的に作成されるもの:**
- Webサービス: `game-evaluator-web`
- PostgreSQLデータベース: `game-evaluator-db`

#### Step 3: 環境変数の設定

1. Dashboard → `game-evaluator-web` サービスを選択
2. 「Environment」タブをクリック
3. 以下を追加:

| キー | 値 |
|------|-----|
| `RAWG_API_KEY` | 取得したRAWG APIキー |
| `OPENAI_API_KEY` | 取得したOpenAI APIキー |
| `SLACK_WEBHOOK_URL` | 取得したSlack Webhook URL |
| `NODE_ENV` | `production` |

4. 「Save Changes」をクリック

**注意:** `DATABASE_URL` は自動設定されます。

#### Step 4: デプロイ完了を待つ

- 初回デプロイには5-10分かかります
- 「Live」ステータスになるまで待つ

#### Step 5: データベースマイグレーション

1. Dashboard → `game-evaluator-web` → 「Shell」タブ
2. 以下のコマンドを実行:

```bash
npm run migrate
```

成功メッセージを確認:
```
✓ Completed: 001_initial_schema.sql
All migrations completed successfully!
```

#### Step 6: 動作確認

1. WebサービスのURLにアクセス
   - 例: `https://game-evaluator-web.onrender.com`
2. まだデータがないため「評価データがありません」と表示されます

#### Step 7: 手動でデータ収集実行

Render Shellで:

```bash
npm run collect
```

**実行内容:**
- RAWG APIからゲーム情報取得
- Google Trendsでトレンド分析
- OpenAI APIでゲーム評価
- データベースに保存
- Slack通知送信

**所要時間: 10-20分**

#### Step 8: 結果確認

1. **Webサイト**: ランキングが表示されることを確認
2. **Slack**: 通知が届くことを確認

---

### 3️⃣ GitHub Actionsの設定

**重要:** ワークフローファイルはGitHub Webインターフェースから追加する必要があります。

詳細は `GITHUB_ACTIONS_SETUP.md` を参照してください。

#### 概要

1. GitHubリポジトリで `.github/workflows/weekly-evaluation.yml` を作成
2. GitHubシークレットを設定:
   - `DATABASE_URL` (Render.comから取得)
   - `RAWG_API_KEY`
   - `OPENAI_API_KEY`
   - `SLACK_WEBHOOK_URL`
3. Actionsタブから手動実行テスト

---

## 📚 参考ドキュメント

- **README.md**: プロジェクト概要、機能説明
- **DEPLOYMENT.md**: 詳細なデプロイ手順
- **GITHUB_ACTIONS_SETUP.md**: GitHub Actions設定手順

---

## ✅ 完了チェックリスト

### 準備
- [ ] RAWG API Key取得
- [ ] OpenAI API Key取得
- [ ] Slack Webhook URL取得

### Render.com
- [ ] Blueprintデプロイ実行
- [ ] 環境変数設定
- [ ] データベースマイグレーション実行
- [ ] 手動データ収集実行
- [ ] Webサイト動作確認
- [ ] Slack通知確認

### GitHub Actions
- [ ] ワークフローファイル作成
- [ ] GitHubシークレット設定
- [ ] 手動実行テスト
- [ ] 自動実行確認（月曜日に確認）

---

## 💡 ヒント

### Render.comの無料プラン制限

- Webサービス: 750時間/月
- データベース: 1GB
- 15分間アクセスがないとスリープ
- 初回アクセス時に起動（30秒-1分）

### コスト見積もり

- **Render.com**: 無料
- **RAWG API**: 無料（20,000リクエスト/月）
- **Google Trends**: 無料
- **OpenAI API**: 週40ゲーム評価で月額 $0.32-0.64 程度

---

## 🆘 問題が発生した場合

### デプロイが失敗する
→ `DEPLOYMENT.md` のトラブルシューティング参照

### データベース接続エラー
→ `DATABASE_URL` の設定を確認

### GitHub Actions が失敗
→ `GITHUB_ACTIONS_SETUP.md` のトラブルシューティング参照

---

## 🎉 完了後

システムが正常に動作したら:

1. 毎週月曜日午前9時に自動実行
2. Slackに通知が届く
3. Webサイトでランキング確認

**お疲れ様でした！** 🚀
