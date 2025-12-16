// グローバル状態
let currentGameType = '';
let isEvaluationRunning = false;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadRankings();
  setupEventListeners();
  startStatusPolling();
});

// イベントリスナー設定
function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', loadRankings);
  document.getElementById('runEvaluationBtn').addEventListener('click', runEvaluation);
  document.getElementById('gameTypeFilter').addEventListener('change', (e) => {
    currentGameType = e.target.value;
    loadRankings();
  });
}

// ランキングを読み込み
async function loadRankings() {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('rankingsContent');
  const noDataEl = document.getElementById('noData');
  const statsEl = document.getElementById('statsContainer');
  const dateEl = document.getElementById('evaluationDate');

  loadingEl.style.display = 'block';
  contentEl.innerHTML = '';
  noDataEl.style.display = 'none';

  try {
    const params = currentGameType ? `?type=${currentGameType}` : '';
    const response = await axios.get(`/api/rankings/latest${params}`);

    if (response.data.success && response.data.data.length > 0) {
      displayRankings(response.data.data);
      displayStats(response.data.stats);
      dateEl.textContent = `評価日: ${response.data.evaluation_date}`;
    } else {
      noDataEl.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading rankings:', error);
    contentEl.innerHTML = '<div class="error">データの読み込みに失敗しました</div>';
  } finally {
    loadingEl.style.display = 'none';
  }
}

// ランキング表示
function displayRankings(rankings) {
  const contentEl = document.getElementById('rankingsContent');
  
  rankings.forEach((game, index) => {
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
    
    const gameCard = document.createElement('div');
    gameCard.className = `game-card ${rankClass}`;
    
    gameCard.innerHTML = `
      <div class="rank-badge">${medal || `#${game.rank}`}</div>
      ${game.image_url ? `<img src="${game.image_url}" alt="${game.title}" class="game-image">` : ''}
      <div class="game-info">
        <h3 class="game-title">${game.title}</h3>
        <div class="game-meta">
          <span class="game-type">
            <i class="fas fa-tag"></i>
            ${game.game_type === 'consumer' ? 'コンシューマー' : 'ソーシャル'}
          </span>
          <span class="release-date">
            <i class="fas fa-calendar"></i>
            ${game.release_date || '未定'}
          </span>
        </div>
        <div class="game-platforms">
          <i class="fas fa-gamepad"></i>
          ${Array.isArray(game.platforms) ? game.platforms.join(', ') : 'PC'}
        </div>
        ${game.developer ? `<div class="game-developer"><i class="fas fa-building"></i> ${game.developer}</div>` : ''}
      </div>
      <div class="game-score">
        <div class="score-main">${game.score}</div>
        <div class="score-label">/10</div>
      </div>
      <div class="game-reasoning">
        ${game.reasoning}
      </div>
      <div class="score-breakdown">
        <div class="score-item">
          <span>🔥 トレンド</span>
          <span>${game.trend_score ? game.trend_score.toFixed(1) : 'N/A'}</span>
        </div>
        <div class="score-item">
          <span>🏢 ブランド</span>
          <span>${game.brand_score ? game.brand_score.toFixed(1) : 'N/A'}</span>
        </div>
        <div class="score-item">
          <span>📺 シリーズ</span>
          <span>${game.series_score ? game.series_score.toFixed(1) : 'N/A'}</span>
        </div>
        <div class="score-item">
          <span>💰 売上</span>
          <span>${game.sales_score ? game.sales_score.toFixed(1) : 'N/A'}</span>
        </div>
      </div>
    `;
    
    contentEl.appendChild(gameCard);
  });
}

// 統計情報表示
function displayStats(stats) {
  const statsEl = document.getElementById('statsContainer');
  
  if (!stats) {
    statsEl.innerHTML = '';
    return;
  }
  
  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon"><i class="fas fa-list"></i></div>
      <div class="stat-value">${stats.total_games || 0}</div>
      <div class="stat-label">総評価数</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon"><i class="fas fa-desktop"></i></div>
      <div class="stat-value">${stats.consumer_count || 0}</div>
      <div class="stat-label">コンシューマー</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon"><i class="fas fa-mobile-alt"></i></div>
      <div class="stat-value">${stats.social_count || 0}</div>
      <div class="stat-label">ソーシャル</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon"><i class="fas fa-star"></i></div>
      <div class="stat-value">${parseFloat(stats.average_score || 0).toFixed(1)}</div>
      <div class="stat-label">平均スコア</div>
    </div>
  `;
}

// 評価を手動実行
async function runEvaluation() {
  if (isEvaluationRunning) {
    showStatus('評価プロセスは既に実行中です', 'warning');
    return;
  }

  const btn = document.getElementById('runEvaluationBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 実行中...';

  try {
    const response = await axios.post('/api/run-evaluation');
    
    if (response.data.success) {
      showStatus('評価プロセスを開始しました。完了まで5〜10分かかります。', 'success');
      isEvaluationRunning = true;
      
      // 30秒後にランキングを自動更新
      setTimeout(() => {
        loadRankings();
      }, 30000);
    }
  } catch (error) {
    console.error('Error running evaluation:', error);
    if (error.response?.status === 409) {
      showStatus('評価プロセスは既に実行中です', 'warning');
    } else {
      showStatus('評価プロセスの開始に失敗しました', 'error');
    }
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-play"></i> 評価を実行';
    }, 3000);
  }
}

// ステータスポーリング
function startStatusPolling() {
  setInterval(async () => {
    try {
      const response = await axios.get('/api/evaluation-status');
      isEvaluationRunning = response.data.is_running;
      
      const btn = document.getElementById('runEvaluationBtn');
      if (isEvaluationRunning) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 実行中...';
      } else if (btn.disabled) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> 評価を実行';
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, 5000); // 5秒ごとにチェック
}

// ステータスメッセージ表示
function showStatus(message, type = 'info') {
  const statusBar = document.getElementById('statusBar');
  const statusMessage = document.getElementById('statusMessage');
  
  statusBar.className = `status-bar status-${type}`;
  statusMessage.textContent = message;
  statusBar.style.display = 'flex';
  
  setTimeout(() => {
    statusBar.style.display = 'none';
  }, 5000);
}
