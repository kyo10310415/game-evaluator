import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { RawgCollector } from '../src/collectors/rawg-collector.js';
import { SteamCollector } from '../src/collectors/steam-collector.js';
import { SocialGameCollector } from '../src/collectors/social-game-collector.js';
import { TrendsCollector } from '../src/collectors/trends-collector.js';
import { AlternativeTrendsCollector } from '../src/collectors/alternative-trends-collector.js';
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
    
    // メタクリティックスコア60以上でフィルタリング
    const filteredGames = allGames.filter(game => {
      // メタクリティックスコアがない場合は対象に含める（新作の可能性があるため）
      return !game.metacritic_score || game.metacritic_score >= 60;
    });
    
    console.log(`Games after Metacritic filter (≥60 or no score): ${filteredGames.length}`);
    
    if (filteredGames.length === 0) {
      console.log('No games passed the Metacritic filter');
      return;
    }
    
    // 2. トレンドスコア取得（Wikipedia + Reddit使用）
    console.log('\n--- Step 2: Fetching trend scores ---');
    const trendsCollector = new AlternativeTrendsCollector();
    const trendScores = {};
    
    // 主要なゲームのみトレンドスコアを取得（API制限対策）
    // Metacriticスコアがあるものを優先して上位20件を選択
    const gamesWithScore = filteredGames.filter(g => g.metacritic_score).sort((a, b) => b.metacritic_score - a.metacritic_score);
    const gamesWithoutScore = filteredGames.filter(g => !g.metacritic_score);
    
    // Metacriticスコアがある場合は15件、ない場合は全て新作とみなして20件取得
    const scoreCount = Math.min(gamesWithScore.length, 15);
    const noScoreCount = Math.min(gamesWithoutScore.length, 20 - scoreCount);
    const topGames = [...gamesWithScore.slice(0, scoreCount), ...gamesWithoutScore.slice(0, noScoreCount)];
    
    console.log(`Selecting top ${topGames.length} games for trend analysis (out of ${filteredGames.length} total)`);
    console.log('Using Wikipedia page views + Reddit mentions for trend data');
    
    for (const game of topGames) {
      try {
        trendScores[game.title] = await trendsCollector.calculateGameTrendScore(game);
        // Wikipedia API制限対策: 1秒待機（Google Trendsより緩い）
        await trendsCollector.delay(1000);
      } catch (error) {
        console.error(`Error fetching trend for "${game.title}":`, error.message);
        trendScores[game.title] = 0;
      }
    }
    
    console.log(`✓ Trend scores fetched for ${Object.keys(trendScores).length} games`);
    
    // 3. AI評価
    console.log('\n--- Step 3: Evaluating games with AI ---');
    const aiEvaluator = new AIEvaluator();
    const evaluations = [];
    
    for (const game of filteredGames) {
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
        
        // レート制限対策：各評価後に2秒待機（OpenAI API Tier 1: 3 RPM制限対策）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
    // 1. RAWG APIから収集（コンシューマーゲーム）
    const rawgCollector = new RawgCollector();
    
    const upcomingGames = await rawgCollector.getUpcomingGames();
    allGames.push(...upcomingGames);
    
    await rawgCollector.delay(1000);
    
    const recentGames = await rawgCollector.getRecentlyReleasedGames();
    allGames.push(...recentGames);
    
    // 2. Steam APIからアップデート情報収集
    console.log('Collecting Steam updates...');
    const steamCollector = new SteamCollector();
    const steamUpdates = await steamCollector.getRecentUpdates(7);
    console.log(`Steam updates collected: ${steamUpdates.length}`);
    allGames.push(...steamUpdates);
    
    // 3. Google Play Storeからソーシャルゲーム収集
    console.log('Collecting social games from Google Play...');
    const socialCollector = new SocialGameCollector();
    
    const newSocialGames = await socialCollector.getNewReleases(20);
    console.log(`New social games collected: ${newSocialGames.length}`);
    allGames.push(...newSocialGames);
    
    const updatedSocialGames = await socialCollector.getRecentlyUpdated(20, 7);
    console.log(`Updated social games collected: ${updatedSocialGames.length}`);
    allGames.push(...updatedSocialGames);
    
    // 4. Webスクレイピング（オプション）
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
