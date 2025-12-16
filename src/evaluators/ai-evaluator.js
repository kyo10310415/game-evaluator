import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * OpenAI APIを使用したゲーム評価
 */
export class AIEvaluator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * コンシューマーゲームの評価
   */
  async evaluateConsumerGame(gameData, trendScore = 0) {
    try {
      console.log(`Evaluating consumer game: ${gameData.title}`);
      
      const prompt = this.buildConsumerGamePrompt(gameData, trendScore);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはゲーム業界の専門家です。新発売・アップデートのゲーム情報を10段階で評価してください。JSON形式で回答してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });
      
      const evaluation = JSON.parse(response.choices[0].message.content);
      
      console.log(`✓ Evaluated "${gameData.title}": Score ${evaluation.total_score}/10`);
      
      return this.normalizeEvaluation(evaluation);
    } catch (error) {
      console.error(`Error evaluating game "${gameData.title}":`, error.message);
      if (error.response) {
        console.error('OpenAI API Error Details:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      return this.getDefaultEvaluation();
    }
  }

  /**
   * ソーシャルゲームの評価
   */
  async evaluateSocialGame(gameData, trendScore = 0) {
    try {
      console.log(`Evaluating social game: ${gameData.title}`);
      
      const prompt = this.buildSocialGamePrompt(gameData, trendScore);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはソーシャルゲーム業界の専門家です。新リリース・アップデート情報を10段階で評価してください。JSON形式で回答してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });
      
      const evaluation = JSON.parse(response.choices[0].message.content);
      
      console.log(`✓ Evaluated "${gameData.title}": Score ${evaluation.total_score}/10`);
      
      return this.normalizeEvaluation(evaluation);
    } catch (error) {
      console.error(`Error evaluating social game "${gameData.title}":`, error.message);
      return this.getDefaultEvaluation();
    }
  }

  /**
   * コンシューマーゲーム評価用プロンプト構築
   */
  buildConsumerGamePrompt(gameData, trendScore) {
    return `
以下のコンシューマーゲームを10段階で評価してください。

【ゲーム情報】
- タイトル: ${gameData.title}
- 発売日: ${gameData.release_date || '未定'}
- 開発元: ${gameData.developer || '不明'}
- 発売元: ${gameData.publisher || '不明'}
- プラットフォーム: ${gameData.platforms?.join(', ') || '不明'}
- ジャンル: ${gameData.genres?.join(', ') || '不明'}
- 説明: ${gameData.description?.substring(0, 500) || 'なし'}
- Metacriticスコア: ${gameData.metacritic_score || 'なし'}
- Google Trendsスコア: ${trendScore.toFixed(2)}

【評価基準】
1. トレンド評価 (trend_score): XやYouTube、SNSで話題かどうか（Google Trendsスコアを参考）
2. ブランド評価 (brand_score): 有名メーカー（任天堂、カプコン、スクエニ等）かどうか
3. シリーズ評価 (series_score): 有名タイトル（ポケモン、モンハン等）のシリーズ・続編か
4. 売上評価 (sales_score): Metacriticスコアやレビュー評価が高いか

各項目を0-10で評価し、total_score（総合評価）を1-10で算出してください。
reasoning（評価理由）も日本語で簡潔に記載してください。

【JSON形式で回答】
{
  "trend_score": <0-10の数値>,
  "brand_score": <0-10の数値>,
  "series_score": <0-10の数値>,
  "sales_score": <0-10の数値>,
  "total_score": <1-10の数値>,
  "reasoning": "<評価理由を100文字以内で>"
}
`;
  }

  /**
   * ソーシャルゲーム評価用プロンプト構築
   */
  buildSocialGamePrompt(gameData, trendScore) {
    return `
以下のソーシャルゲームを10段階で評価してください。

【ゲーム情報】
- タイトル: ${gameData.title}
- リリース日: ${gameData.release_date || '未定'}
- 開発元: ${gameData.developer || '不明'}
- 説明: ${gameData.description?.substring(0, 500) || 'なし'}
- Google Trendsスコア: ${trendScore.toFixed(2)}

【評価基準】
1. トレンド評価 (trend_score): XやYouTube、SNSで話題かどうか（Google Trendsスコアを参考）
2. ブランド評価 (brand_score): 有名メーカー（Cygames、アニプレックス等）や有名IPか
3. シリーズ評価 (series_score): 人気タイトルのシリーズ・続編か
4. 売上評価 (sales_score): セールスランキングやユーザー評価が高いか（推測）

各項目を0-10で評価し、total_score（総合評価）を1-10で算出してください。
reasoning（評価理由）も日本語で簡潔に記載してください。

【JSON形式で回答】
{
  "trend_score": <0-10の数値>,
  "brand_score": <0-10の数値>,
  "series_score": <0-10の数値>,
  "sales_score": <0-10の数値>,
  "total_score": <1-10の数値>,
  "reasoning": "<評価理由を100文字以内で>"
}
`;
  }

  /**
   * 評価結果の正規化
   */
  normalizeEvaluation(evaluation) {
    return {
      trend_score: this.clampScore(evaluation.trend_score),
      brand_score: this.clampScore(evaluation.brand_score),
      series_score: this.clampScore(evaluation.series_score),
      sales_score: this.clampScore(evaluation.sales_score),
      total_score: this.clampScore(evaluation.total_score, 1, 10),
      reasoning: evaluation.reasoning || '評価を実施しました'
    };
  }

  /**
   * スコアを範囲内に制限
   */
  clampScore(score, min = 0, max = 10) {
    const num = parseFloat(score) || 0;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * デフォルト評価（エラー時）
   */
  getDefaultEvaluation() {
    return {
      trend_score: 5,
      brand_score: 5,
      series_score: 5,
      sales_score: 5,
      total_score: 5,
      reasoning: '評価情報が不足しているため、中間評価としました'
    };
  }

  /**
   * バッチ評価（複数ゲーム）
   */
  async evaluateBatch(games, trendScores = {}) {
    const results = [];
    
    for (const game of games) {
      try {
        const trendScore = trendScores[game.title] || 0;
        
        let evaluation;
        if (game.game_type === 'consumer') {
          evaluation = await this.evaluateConsumerGame(game, trendScore);
        } else {
          evaluation = await this.evaluateSocialGame(game, trendScore);
        }
        
        results.push({
          game,
          evaluation
        });
        
        // APIレート制限対策
        await this.delay(1000);
      } catch (error) {
        console.error(`Error in batch evaluation for "${game.title}":`, error.message);
      }
    }
    
    return results;
  }

  /**
   * 遅延処理
   */
  async delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AIEvaluator;
