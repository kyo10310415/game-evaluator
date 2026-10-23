import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { adminBoundary, installEvaluationRoutes } from './security.js';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp({ EvaluationModel, spawn: launch = spawn, env = process.env, now = Date.now }) {
const app = express();
const authenticate = adminBoundary(env);
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return authenticate(req, res, next);
  next();
});
app.get('/admin', authenticate, (_req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// Middleware
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, '../public')));

// データベース接続確認
// API Routes

/**
 * ヘルスチェック
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 最新のランキングを取得
 */
app.get('/api/rankings/latest', async (req, res) => {
  try {
    const gameType = req.query.type || null; // 'consumer', 'social', or null for all
    const limit = parseInt(req.query.limit) || 10;
    
    const latestDate = await EvaluationModel.getLatestEvaluationDate();
    
    if (!latestDate) {
      return res.json({
        success: true,
        data: [],
        message: 'No evaluations found'
      });
    }
    
    const rankings = await EvaluationModel.getRankingByDate(latestDate, gameType, limit);
    const stats = await EvaluationModel.getEvaluationStats(latestDate);
    
    res.json({
      success: true,
      evaluation_date: latestDate,
      stats: stats,
      data: rankings
    });
  } catch (error) {
    console.error('Error fetching latest rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rankings'
    });
  }
});

/**
 * 指定日のランキングを取得
 */
app.get('/api/rankings/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const gameType = req.query.type || null;
    const limit = parseInt(req.query.limit) || 50;
    
    // 日付フォーマット検証
    if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const rankings = await EvaluationModel.getRankingByDate(date, gameType, limit);
    const stats = await EvaluationModel.getEvaluationStats(date);
    
    res.json({
      success: true,
      evaluation_date: date,
      stats: stats,
      data: rankings
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rankings'
    });
  }
});

/**
 * スコア分布を取得
 */
app.get('/api/stats/distribution', async (req, res) => {
  try {
    const latestDate = await EvaluationModel.getLatestEvaluationDate();
    
    if (!latestDate) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const distribution = await EvaluationModel.getScoreDistribution(latestDate);
    
    res.json({
      success: true,
      evaluation_date: latestDate,
      data: distribution
    });
  } catch (error) {
    console.error('Error fetching score distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch distribution'
    });
  }
});

installEvaluationRoutes(app, { spawn: launch, scriptPath: path.join(__dirname, '../scripts/collect-and-evaluate.js'), now });

/**
 * フロントエンド（トップページ）
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

return app;
}
