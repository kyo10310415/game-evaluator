# 🚀 デプロイ手順書

## 概要

このドキュメントでは、ゲームリリース評価システムをGitHub + Render.comでデプロイする詳細な手順を説明します。

## 📋 前提条件

### 必要なアカウント
- ✅ GitHub アカウント
- ✅ Render.com アカウント（無料プランでOK）
- ✅ OpenAI アカウント（API利用）
- ✅ RAWG アカウント（API利用）
- ✅ Slack ワークスペース（通知用）

### 必要なAPIキー
1. **RAWG API Key**
2. **OpenAI API Key**
3. **Slack Webhook URL**

---

## 🔑 Step 1: APIキーの取得

### 1.1 RAWG API キーの取得

1. https://rawg.io/apidocs にアクセス
2. 「Get API Key」をクリック
3. メールアドレスで登録
4. ダッシュボードからAPIキーをコピー
5. 無料枠: 20,000リクエスト/月

**取得したキー:**
```
RAWG_API_KEY=ここにコピーしたキーを保存
```

### 1.2 OpenAI API キーの取得

1. https://platform.openai.com/ にログイン
2. 左メニュー「API keys」をクリック
3. 「Create new secret key」をクリック
4. キーをコピー（2度と表示されないので注意！）

**取得したキー:**
```
OPENAI_API_KEY=sk-ここにコピーしたキーを保存
```

**料金目安:**
- GPT-4o-mini: $0.15 / 1M input tokens
- 1ゲーム評価あたり約 $0.001-0.002

### 1.3 Slack Webhook URLの取得

1. https://api.slack.com/apps にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. アプリ名とワークスペースを選択
5. 左メニュー「Incoming Webhooks」をクリック
6. 「Activate Incoming Webhooks」をON
7. 「Add New Webhook to Workspace」をクリック
8. 通知を送信するチャンネルを選択
9. Webhook URLをコピー

**取得したURL:**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

---

## 📦 Step 2: GitHubリポジトリの作成とプッシュ

### 2.1 GitHubで新規リポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `game-evaluator`（任意）
3. 公開/非公開を選択
4. READMEやライセンスは追加しない（既に存在するため）
5. 「Create repository」をクリック

### 2.2 ローカルコードをプッシュ

```bash
# GitHubリポジトリのURLを確認（例）
# https://github.com/YOUR_USERNAME/game-evaluator.git

cd /home/user/webapp

# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/game-evaluator.git

# プッシュ
git branch -M main
git push -u origin main
```

**プッシュ成功の確認:**
GitHubリポジトリページで全てのファイルが表示されることを確認

---

## 🌐 Step 3: Render.comでのデプロイ

### 3.1 Render.comにログイン

1. https://render.com/ にアクセス
2. GitHubアカウントでログイン（推奨）

### 3.2 Blueprint経由でデプロイ

1. ダッシュボードで「New +」→「Blueprint」をクリック
2. 「Connect a repository」をクリック
3. GitHubリポジトリを選択（`game-evaluator`）
4. `render.yaml` が自動検出される
5. 「Apply」をクリック

**自動的に作成されるもの:**
- ✅ Webサービス: `game-evaluator-web`
- ✅ PostgreSQLデータベース: `game-evaluator-db`

### 3.3 環境変数の設定

1. ダッシュボードから `game-evaluator-web` サービスを選択
2. 左メニュー「Environment」をクリック
3. 以下の環境変数を追加:

| キー | 値 |
|------|-----|
| `RAWG_API_KEY` | Step 1.1で取得したRAWG APIキー |
| `OPENAI_API_KEY` | Step 1.2で取得したOpenAI APIキー |
| `SLACK_WEBHOOK_URL` | Step 1.3で取得したSlack Webhook URL |
| `NODE_ENV` | `production` |

4. 「Save Changes」をクリック

**注意:** `DATABASE_URL` は自動設定されるため、追加不要です。

### 3.4 デプロイの待機

- 初回デプロイには5-10分程度かかります
- ログでデプロイ状況を確認できます
- 成功すると「Live」ステータスになります

### 3.5 データベースマイグレーション実行

デプロイ完了後、データベーススキーマを作成する必要があります。

1. ダッシュボードから `game-evaluator-web` サービスを選択
2. 右上の「Shell」タブをクリック
3. 以下のコマンドを実行:

```bash
npm run migrate
```

4. 成功メッセージを確認:
```
✓ Completed: 001_initial_schema.sql
All migrations completed successfully!
```

---

## 🤖 Step 4: GitHub Actionsの設定

### 4.1 GitHubシークレットの設定

1. GitHubリポジトリページにアクセス
2. 「Settings」→「Secrets and variables」→「Actions」
3. 「New repository secret」をクリック
4. 以下のシークレットを追加:

| Name | Secret |
|------|--------|
| `DATABASE_URL` | Render.comのPostgreSQL接続URL（後述） |
| `RAWG_API_KEY` | RAWG APIキー |
| `OPENAI_API_KEY` | OpenAI APIキー |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL |

### 4.2 DATABASE_URLの取得

1. Render.com ダッシュボード
2. `game-evaluator-db` データベースを選択
3. 「Info」タブで「Internal Database URL」をコピー
4. GitHubシークレットに追加

**URLフォーマット例:**
```
postgresql://user:password@hostname:5432/database_name
```

### 4.3 自動実行スケジュール

`.github/workflows/weekly-evaluation.yml` に設定済み:
- **毎週月曜日 午前9時（日本時間）** に自動実行
- **手動実行も可能**

### 4.4 手動実行テスト

1. GitHubリポジトリの「Actions」タブ
2. 「Weekly Game Evaluation」ワークフローを選択
3. 「Run workflow」→「Run workflow」
4. 実行ログを確認

**注意:** 初回実行には10-20分程度かかります（APIレート制限のため）

---

## ✅ Step 5: 動作確認

### 5.1 Webサイトへのアクセス

1. Render.com ダッシュボードから `game-evaluator-web` を選択
2. 上部に表示されるURLをクリック
   - 例: `https://game-evaluator-web.onrender.com`
3. ランキング画面が表示されることを確認

**初回アクセス時の注意:**
- データがまだない場合、「評価データがありません」と表示されます
- GitHub Actionsまたは手動実行でデータを収集する必要があります

### 5.2 手動でデータ収集を実行

Render Shellから手動実行:

```bash
npm run collect
```

**実行内容:**
1. RAWG APIからゲーム情報取得
2. Google Trendsでトレンド分析
3. OpenAI APIでゲーム評価
4. データベースに保存
5. Slack通知送信

### 5.3 Slack通知の確認

1. 指定したSlackチャンネルを確認
2. ランキング通知が届いていることを確認

### 5.4 API動作確認

以下のAPIエンドポイントにアクセス:

```bash
# ヘルスチェック
curl https://YOUR_APP_URL.onrender.com/api/health

# 最新ランキング
curl https://YOUR_APP_URL.onrender.com/api/rankings/latest

# コンシューマーゲームのみ
curl https://YOUR_APP_URL.onrender.com/api/rankings/latest?type=consumer
```

---

## 🔧 トラブルシューティング

### デプロイが失敗する

**症状:** Render.comでデプロイが「Failed」になる

**解決方法:**
1. ログを確認
2. 環境変数が正しく設定されているか確認
3. `package.json` の依存関係を確認

### データベース接続エラー

**症状:** `Database connection failed`

**解決方法:**
1. `DATABASE_URL` が正しく設定されているか確認
2. Render.comでデータベースが起動しているか確認
3. マイグレーションを実行したか確認

### GitHub Actions が失敗する

**症状:** ワークフロー実行が失敗

**解決方法:**
1. シークレットが全て設定されているか確認
2. `DATABASE_URL` が正しいか確認
3. APIキーが有効か確認
4. ログで詳細エラーを確認

### Slack通知が届かない

**症状:** 評価完了後もSlack通知がない

**解決方法:**
1. Webhook URLが正しいか確認
2. チャンネルへの投稿権限があるか確認
3. Render ShellまたはGitHub Actionsログでエラー確認

### APIレート制限エラー

**症状:** `Rate limit exceeded`

**解決方法:**
1. **Google Trends:** 2秒の遅延を設定済み（調整可能）
2. **RAWG API:** 無料枠20,000リクエスト/月を確認
3. **OpenAI API:** 使用量を確認、必要に応じてプラン変更

---

## 📊 運用ガイド

### 定期実行の確認

1. GitHub Actions の「Actions」タブで実行履歴を確認
2. 毎週月曜日午前9時に自動実行
3. 失敗した場合はSlackに通知

### データベースのメンテナンス

```bash
# Render Shellでデータベースに接続
psql $DATABASE_URL

# 古い評価データの削除（3ヶ月以上前）
DELETE FROM evaluations WHERE evaluation_date < NOW() - INTERVAL '3 months';
```

### ログの確認

**Render.com:**
- ダッシュボード → サービス選択 → 「Logs」タブ

**GitHub Actions:**
- リポジトリ → 「Actions」タブ → ワークフロー選択

### コストモニタリング

**Render.com（無料プラン）:**
- Webサービス: 750時間/月（月初にリセット）
- PostgreSQL: 1GB（容量超過に注意）

**OpenAI API:**
- Usage Dashboard: https://platform.openai.com/usage
- 1ゲーム評価あたり $0.001-0.002
- 週40ゲーム評価 → 月額 $0.32-0.64 程度

**RAWG API:**
- 無料枠: 20,000リクエスト/月
- 週1回実行で余裕あり

---

## 🔄 更新・再デプロイ

### コードを更新した場合

```bash
# 変更をコミット
git add .
git commit -m "Update: 機能追加"

# GitHubにプッシュ
git push origin main
```

**Render.comが自動デプロイ:**
- GitHubへのプッシュで自動的に再デプロイ
- 5-10分でデプロイ完了

### 環境変数を変更した場合

1. Render.com ダッシュボード
2. サービス選択 → 「Environment」
3. 変更して「Save Changes」
4. 自動的に再起動

---

## 📝 まとめ

✅ **デプロイ完了チェックリスト:**

- [ ] 全てのAPIキーを取得
- [ ] GitHubリポジトリを作成してプッシュ
- [ ] Render.comでBlueprintデプロイ
- [ ] 環境変数を設定
- [ ] データベースマイグレーション実行
- [ ] GitHubシークレットを設定
- [ ] 手動実行でデータ収集テスト
- [ ] Webサイトにアクセスしてランキング確認
- [ ] Slack通知を確認
- [ ] GitHub Actionsの自動実行を確認

**🎉 全て完了したら、システムが稼働中です！**

---

**サポート:**
問題がある場合は、GitHubのIssuesまたはログを確認してください。
