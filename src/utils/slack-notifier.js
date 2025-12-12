import axios from 'axios';
import dotenv from 'dotenv';
import { query } from './database.js';

dotenv.config();

/**
 * Slack通知機能
 */
export class SlackNotifier {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  /**
   * ランキングをSlackに送信
   */
  async sendRanking(rankings, evaluationDate, gameType = 'all') {
    try {
      if (!this.webhookUrl) {
        console.log('Slack webhook URL not configured. Skipping notification.');
        return false;
      }

      console.log(`Sending ranking to Slack (${gameType})...`);

      const message = this.formatRankingMessage(rankings, evaluationDate, gameType);
      
      await axios.post(this.webhookUrl, {
        text: message.text,
        blocks: message.blocks
      });

      // 通知履歴を保存
      await this.saveNotificationHistory('ranking', message.text, 'success');
      
      console.log('✓ Ranking sent to Slack successfully');
      return true;
    } catch (error) {
      console.error('Error sending ranking to Slack:', error.message);
      await this.saveNotificationHistory('ranking', error.message, 'failed', error.message);
      return false;
    }
  }

  /**
   * ランキングメッセージをフォーマット
   */
  formatRankingMessage(rankings, evaluationDate, gameType) {
    const typeLabel = gameType === 'consumer' ? 'コンシューマーゲーム' : 
                      gameType === 'social' ? 'ソーシャルゲーム' : '全ゲーム';
    
    const topGames = rankings.slice(0, 10);
    
    let text = `🎮 *ゲームおすすめランキング (${evaluationDate})*\n`;
    text += `📊 カテゴリ: ${typeLabel}\n\n`;
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎮 ゲームおすすめランキング (${evaluationDate})`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*カテゴリ:* ${typeLabel}\n*評価数:* ${rankings.length}件`
        }
      },
      {
        type: 'divider'
      }
    ];

    topGames.forEach((game, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const platforms = Array.isArray(game.platforms) ? game.platforms.join(', ') : '不明';
      
      text += `${medal} *${game.title}* (${game.score}/10)\n`;
      text += `   ${game.reasoning}\n\n`;
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${medal} ${game.title}*\n` +
                `*スコア:* ${game.score}/10 ⭐\n` +
                `*発売日:* ${game.release_date || '未定'}\n` +
                `*プラットフォーム:* ${platforms}\n` +
                `*理由:* ${game.reasoning}`
        }
      });
      
      if (game.image_url) {
        blocks.push({
          type: 'image',
          image_url: game.image_url,
          alt_text: game.title
        });
      }
      
      blocks.push({
        type: 'divider'
      });
    });

    // 詳細スコア内訳（トップ3のみ）
    if (topGames.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 トップ3の詳細スコア*'
        }
      });
      
      topGames.slice(0, 3).forEach((game, index) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${game.title}*\n` +
                  `🔥 トレンド: ${game.trend_score?.toFixed(1) || 'N/A'} | ` +
                  `🏢 ブランド: ${game.brand_score?.toFixed(1) || 'N/A'} | ` +
                  `📺 シリーズ: ${game.series_score?.toFixed(1) || 'N/A'} | ` +
                  `💰 売上: ${game.sales_score?.toFixed(1) || 'N/A'}`
          }
        });
      });
    }

    return { text, blocks };
  }

  /**
   * エラー通知を送信
   */
  async sendError(errorMessage, context = '') {
    try {
      if (!this.webhookUrl) {
        return false;
      }

      const message = {
        text: `❌ エラーが発生しました`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '❌ エラー通知',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Context:* ${context}\n*Error:* ${errorMessage}`
            }
          }
        ]
      };

      await axios.post(this.webhookUrl, message);
      await this.saveNotificationHistory('error', errorMessage, 'success');
      
      return true;
    } catch (error) {
      console.error('Error sending error notification to Slack:', error.message);
      return false;
    }
  }

  /**
   * 実行完了通知を送信
   */
  async sendCompletionNotice(stats) {
    try {
      if (!this.webhookUrl) {
        return false;
      }

      const message = {
        text: '✅ ゲーム評価が完了しました',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✅ ゲーム評価完了',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*評価日:* ${stats.evaluation_date}\n` +
                    `*総評価数:* ${stats.total_games}件\n` +
                    `*コンシューマー:* ${stats.consumer_count}件\n` +
                    `*ソーシャル:* ${stats.social_count}件\n` +
                    `*平均スコア:* ${stats.average_score?.toFixed(2)}/10`
            }
          }
        ]
      };

      await axios.post(this.webhookUrl, message);
      await this.saveNotificationHistory('completion', JSON.stringify(stats), 'success');
      
      return true;
    } catch (error) {
      console.error('Error sending completion notice to Slack:', error.message);
      return false;
    }
  }

  /**
   * 通知履歴を保存
   */
  async saveNotificationHistory(type, message, status, errorMessage = null) {
    try {
      const sql = `
        INSERT INTO notification_history (notification_type, message, status, error_message)
        VALUES ($1, $2, $3, $4)
      `;
      
      await query(sql, [type, message, status, errorMessage]);
    } catch (error) {
      console.error('Error saving notification history:', error.message);
    }
  }
}

export default SlackNotifier;
