// グローバル変数
let currentGameType = '';
let rankingsData = [];

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * アプリケーション初期化
 */
function initializeApp() {
    // イベントリスナーの設定
    document.getElementById('gameTypeFilter').addEventListener('change', handleFilterChange);
    document.getElementById('refreshBtn').addEventListener('click', loadRankings);
    
    // 初回ロード
    loadRankings();
}

/**
 * フィルター変更ハンドラー
 */
function handleFilterChange(event) {
    currentGameType = event.target.value;
    loadRankings();
}

/**
 * ランキングデータを読み込み
 */
async function loadRankings() {
    const loading = document.getElementById('loading');
    const rankingsContent = document.getElementById('rankingsContent');
    const noData = document.getElementById('noData');
    
    try {
        // ローディング表示
        loading.style.display = 'block';
        rankingsContent.style.display = 'none';
        noData.style.display = 'none';
        
        // APIリクエスト
        const params = currentGameType ? `?type=${currentGameType}` : '';
        const response = await axios.get(`/api/rankings/latest${params}`);
        
        if (response.data.success) {
            rankingsData = response.data.data;
            
            // 評価日を表示
            if (response.data.evaluation_date) {
                document.getElementById('evaluationDate').textContent = 
                    `評価日: ${formatDate(response.data.evaluation_date)}`;
            }
            
            // 統計情報を表示
            if (response.data.stats) {
                displayStats(response.data.stats);
            }
            
            // ランキング表示
            if (rankingsData.length > 0) {
                displayRankings(rankingsData);
                rankingsContent.style.display = 'flex';
            } else {
                noData.style.display = 'block';
            }
        } else {
            noData.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading rankings:', error);
        noData.style.display = 'block';
        showError('データの読み込みに失敗しました');
    } finally {
        loading.style.display = 'none';
    }
}

/**
 * 統計情報を表示
 */
function displayStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
    
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total_games || 0}</div>
            <div class="stat-label">評価ゲーム数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${parseFloat(stats.average_score || 0).toFixed(1)}</div>
            <div class="stat-label">平均スコア</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.consumer_count || 0}</div>
            <div class="stat-label">コンシューマー</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.social_count || 0}</div>
            <div class="stat-label">ソーシャル</div>
        </div>
    `;
    
    statsContainer.innerHTML = statsHTML;
}

/**
 * ランキングを表示
 */
function displayRankings(rankings) {
    const rankingsContent = document.getElementById('rankingsContent');
    
    const rankingsHTML = rankings.map((game, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        const gameTypeLabel = game.game_type === 'consumer' ? 'コンシューマー' : 'ソーシャル';
        const platforms = Array.isArray(game.platforms) ? game.platforms : [];
        
        return `
            <div class="game-card ${rankClass}">
                <div class="game-header">
                    <div class="game-title-section">
                        <div class="game-rank">${medal}</div>
                        <h3 class="game-title">${escapeHtml(game.title)}</h3>
                        <div class="game-meta">
                            <span>
                                <i class="fas fa-tag"></i>
                                ${gameTypeLabel}
                            </span>
                            ${game.release_date ? `
                                <span>
                                    <i class="fas fa-calendar"></i>
                                    ${formatDate(game.release_date)}
                                </span>
                            ` : ''}
                            ${game.developer ? `
                                <span>
                                    <i class="fas fa-building"></i>
                                    ${escapeHtml(game.developer)}
                                </span>
                            ` : ''}
                        </div>
                        ${platforms.length > 0 ? `
                            <div class="game-platforms">
                                ${platforms.map(p => `
                                    <span class="platform-badge">${escapeHtml(p)}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="game-score">
                        <div class="score-value">${game.score}</div>
                        <div class="score-label">/ 10</div>
                    </div>
                </div>
                
                <div class="game-reasoning">
                    <i class="fas fa-comment-dots"></i>
                    ${escapeHtml(game.reasoning || '評価理由なし')}
                </div>
                
                <div class="game-details">
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-fire"></i> トレンド
                        </div>
                        <div class="detail-value">${formatScore(game.trend_score)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-building"></i> ブランド
                        </div>
                        <div class="detail-value">${formatScore(game.brand_score)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-tv"></i> シリーズ
                        </div>
                        <div class="detail-value">${formatScore(game.series_score)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-chart-line"></i> 売上
                        </div>
                        <div class="detail-value">${formatScore(game.sales_score)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    rankingsContent.innerHTML = rankingsHTML;
}

/**
 * 日付をフォーマット
 */
function formatDate(dateStr) {
    if (!dateStr) return '未定';
    try {
        return dayjs(dateStr).format('YYYY年MM月DD日');
    } catch {
        return dateStr;
    }
}

/**
 * スコアをフォーマット
 */
function formatScore(score) {
    if (score === null || score === undefined) return 'N/A';
    return parseFloat(score).toFixed(1);
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * エラー表示
 */
function showError(message) {
    console.error(message);
    // 必要に応じてユーザーにエラーメッセージを表示
}
