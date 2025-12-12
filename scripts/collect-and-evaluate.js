import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { RawgCollector } from '../src/collectors/rawg-collector.js';
import { TrendsCollector } from '../src/collectors/trends-collector.js';
import { GameScraper } from '../src/collectors/scraper.js';
import { AIEvaluator } from '../src/evaluators/ai-evaluator.js';
import { GameModel } from '../src/models/game-model.js';
import { EvaluationModel } from '../src/models/evaluation-model.js';
import { SlackNotifier } from '../src/utils/slack-notifier.js';
import { testConnection } from '../src/utils/database.js';

dotenv.config();

/**
 * メイン処理: ゲーム情報収集と評価
 */
async function main() {
  console.log('=== Game Release Evaluator Started ===');
  console.log(`Execution time: ${new Date().toISOString()}`);
  
  try {
    // データベース接続確認
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    const evaluationDate = dayjs().format('YYYY-MM-DD');
    
    // 1. データ収集
    console.log('\n--- Step 1: Collecting game data ---');
    const allGames = await collectGameData();
    
    if (allGames.length === 0) {
      console.log('No games found to evaluate');
      return;
    }
    
    console.log(`Total games collected: ${allGames.length}`);
    
    // 2. トレンドスコア取得
    console.log('\n--- Step 2: Fetching trend scores ---');
    const trendsCollector = new TrendsCollector();
    const trendScores = {};
    
    // 主要なゲームのみトレンドスコアを取得（API制限対策）
    const topGames = allGames.slice(0, 20);
    for (const game of topGames) {
      try {
        trendScores[game.title] = await trendsCollector.calculateGameTrendScore(game);
        await trendsCollector.delay(2000);
      } catch (error) {
        console.error(`Error fetching trend for "${game.title}":`, error.message);
        trendScores[game.title] = 0;
      }
    }
    
    // 3. AI評価
    console.log('\n--- Step 3: Evaluating games with AI ---');
    const aiEvaluator = new AIEvaluator();
    const evaluations = [];
    
    for (const game of allGames) {
      try {
        // ゲームをデータベースに保存
        const gameId = await GameModel.upsertGame(game);
        
        // トレンドスコアを取得
        const trendScore = trendScores[game.title] || 0;
        
        // AI評価実行
        let evaluation;
        if (game.game_type === 'consumer') {
          evaluation = await aiEvaluator.evaluateConsumerGame(game, trendScore);
        } else {
          evaluation = await aiEvaluator.evaluateSocialGame(game, trendScore);
        }
        
        // レート制限対策：各評価後に1秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 評価を保存
        await EvaluationModel.saveEvaluation(
          gameId,
          evaluation,
          evaluationDate,
          'new_release'
        );
        
        evaluations.push({
          gameId,
          game,
          evaluation
        });
        
        console.log(`✓ Evaluated: ${game.title} (Score: ${evaluation.total_score}/10)`);
        
        // APIレート制限対策
        await aiEvaluator.delay(1000);
      } catch (error) {
        console.error(`Error evaluating "${game.title}":`, error.message);
      }
    }
    
    // 4. ランキング生成
    console.log('\n--- Step 4: Generating rankings ---');
    const consumerRanking = await EvaluationModel.getRankingByDate(evaluationDate, 'consumer', 50);
    const socialRanking = await EvaluationModel.getRankingByDate(evaluationDate, 'social', 50);
    const allRanking = await EvaluationModel.getRankingByDate(evaluationDate, null, 100);
    
    console.log(`Consumer games ranking: ${consumerRanking.length} games`);
    console.log(`Social games ranking: ${socialRanking.length} games`);
    console.log(`All games ranking: ${allRanking.length} games`);
    
    // 5. Slack通知
    console.log('\n--- Step 5: Sending Slack notifications ---');
    const slackNotifier = new SlackNotifier();
    
    if (consumerRanking.length > 0) {
      await slackNotifier.sendRanking(consumerRanking, evaluationDate, 'consumer');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (socialRanking.length > 0) {
      await slackNotifier.sendRanking(socialRanking, evaluationDate, 'social');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 統計情報送信
    const stats = await EvaluationModel.getEvaluationStats(evaluationDate);
    if (stats) {
      stats.evaluation_date = evaluationDate;
      await slackNotifier.sendCompletionNotice(stats);
    }
    
    console.log('\n=== Game Release Evaluator Completed Successfully ===');
    process.exit(0);
  } catch (error) {
    console.error('\n=== Error in main process ===');
    console.error(error);
    
    // エラー通知
    try {
      const slackNotifier = new SlackNotifier();
      await slackNotifier.sendError(error.message, 'Main process');
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError.message);
    }
    
    process.exit(1);
  }
}

/**
 * ゲームデータ収集
 */
async function collectGameData() {
  const allGames = [];
  
  try {
    // RAWG APIから収集
    const rawgCollector = new RawgCollector();
    
    // 今後1ヶ月のゲーム
    const upcomingGames = await rawgCollector.getUpcomingGames();
    allGames.push(...upcomingGames);
    
    await rawgCollector.delay(1000);
    
    // 過去1週間のゲーム
    const recentGames = await rawgCollector.getRecentlyReleasedGames();
    allGames.push(...recentGames);
    
    // Webスクレイピング（オプション）
    if (process.env.ENABLE_SCRAPING === 'true') {
      const scraper = new GameScraper();
      const scrapedGames = await scraper.scrapeAllSources();
      allGames.push(...scrapedGames);
    }
    
    // 重複削除
    const uniqueGames = deduplicateGames(allGames);
    
    return uniqueGames;
  } catch (error) {
    console.error('Error collecting game data:', error.message);
    return allGames;
  }
}

/**
 * ゲームの重複を除去
 */
function deduplicateGames(games) {
  const seen = new Map();
  
  games.forEach(game => {
    const key = game.rawg_id || `${game.title}_${game.release_date}`;
    if (!seen.has(key)) {
      seen.set(key, game);
    }
  });
  
  return Array.from(seen.values());
}

/**
 * 遅延処理（ユーティリティ）
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// スクリプト実行
main();
