import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { testConnection } from './utils/database.js';
import { EvaluationModel } from './models/evaluation-model.js';
import dayjs from 'dayjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// データベース接続確認
testConnection();

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
    const limit = parseInt(req.query.limit) || 50;
    
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

/**
 * 手動で評価プロセスを実行
 */
let isRunning = false;
let runningProcess = null;

app.post('/api/run-evaluation', (req, res) => {
  if (isRunning) {
    return res.status(409).json({
      success: false,
      error: 'Evaluation is already running'
    });
  }

  isRunning = true;
  
  res.json({
    success: true,
    message: 'Evaluation process started',
    status: 'running'
  });

  // バックグラウンドでスクリプト実行
  const scriptPath = path.join(__dirname, '../scripts/collect-and-evaluate.js');
  runningProcess = spawn('node', [scriptPath], {
    detached: true,
    stdio: 'ignore'
  });

  runningProcess.unref();

  runningProcess.on('exit', (code) => {
    isRunning = false;
    runningProcess = null;
    console.log(`Evaluation process exited with code ${code}`);
  });
});

/**
 * 評価プロセスの状態を取得
 */
app.get('/api/evaluation-status', (req, res) => {
  res.json({
    success: true,
    is_running: isRunning,
    timestamp: new Date().toISOString()
  });
});

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

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
