import { Router, Response } from 'express';
import { getDb, getApiKey } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取语录历史
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const quotes = db.prepare(
      'SELECT * FROM quotes WHERE user_id = ? ORDER BY generated_at DESC LIMIT 20'
    ).all(req.userId);
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取语录失败' });
  }
});

// 生成语录
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    const { forceType } = req.body || {};
    const quote = await generateQuote(db, req.userId!, character, forceType);

    const result = db.prepare(
      'INSERT INTO quotes (user_id, content, type) VALUES (?, ?, ?)'
    ).run(req.userId, quote.content, quote.type);

    const saved = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '生成语录失败' });
  }
});

// 导出公用函数供 checkin 路由调用
export async function generateQuote(
  db: any,
  userId: number,
  character: any,
  forceType?: 'encourage' | 'warning'
): Promise<{ content: string; type: 'encourage' | 'warning' }> {
  // 计算打卡率
  const todayStats = db.prepare(`
    SELECT COUNT(*) as cnt FROM checkin_records
    WHERE user_id = ? AND date(checked_at) = date('now', 'localtime')
  `).get(userId) as any;

  const yesterdayStats = db.prepare(`
    SELECT COUNT(*) as cnt FROM checkin_records
    WHERE user_id = ? AND date(checked_at) = date('now', 'localtime', '-1 day')
  `).get(userId) as any;

  const habitCount = db.prepare('SELECT COUNT(*) as cnt FROM habits WHERE user_id = ?').get(userId) as any;
  const totalHabits = habitCount.cnt || 1;
  const todayRate = todayStats.cnt / totalHabits;
  const yesterdayRate = yesterdayStats.cnt / totalHabits;

  let quoteType: 'encourage' | 'warning';
  if (forceType) {
    quoteType = forceType;
  } else if (todayRate < yesterdayRate && yesterdayRate > 0) {
    quoteType = 'warning';
  } else if (todayRate >= 0.7) {
    quoteType = 'encourage';
  } else if (todayRate < 0.3) {
    quoteType = 'warning';
  } else {
    quoteType = 'encourage';
  }

  // 尝试 DeepSeek API
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const content = await callDeepSeek(character, todayRate, yesterdayRate, quoteType);
      if (content) return { content, type: quoteType };
    } catch (e) {
      console.error('DeepSeek API error:', e);
    }
  }

  // Fallback
  return {
    content: generateFallbackQuote(quoteType, character),
    type: quoteType,
  };
}

async function callDeepSeek(
  character: any,
  todayRate: number,
  yesterdayRate: number,
  quoteType: 'encourage' | 'warning'
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const rateChange = todayRate - yesterdayRate;
  const rateChangeText = rateChange > 0
    ? `比昨天提升了${Math.round(rateChange * 100)}%`
    : rateChange < 0
    ? `比昨天下降了${Math.round(Math.abs(rateChange) * 100)}%`
    : '与昨天持平';

  const typeInstruction = quoteType === 'warning'
    ? '请生成一条警示语录，提醒用户不要懈怠，语气略带紧迫感但保持RPG游戏风格。'
    : '请生成一条鼓励语录，激励用户继续保持自律，语气积极向上有RPG游戏风格。';

  const systemPrompt = `你是一个自律养成RPG游戏的AI助手，名叫"自律精灵"。你的任务是根据用户数据生成个性化的语录。语录长度不超过60字，生动有趣，有RPG游戏风格。直接输出语录内容，不要带任何前缀、引号或说明。`;

  const userPrompt = `用户等级：Lv.${character.level}
用户称号：${character.title}
连续打卡天数：${character.current_streak}天
总打卡次数：${character.total_checkins}次
今日打卡完成率：${Math.round(todayRate * 100)}%（${rateChangeText}）

${typeInstruction}`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 120,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    console.error('DeepSeek API HTTP error:', response.status);
    return null;
  }

  const data = await response.json() as any;
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (text) {
    return text.replace(/^["'""]|["'""]$/g, '').trim();
  }
  return null;
}

function generateFallbackQuote(
  type: 'encourage' | 'warning',
  character: any
): string {
  if (type === 'warning') {
    const warningQuotes = [
      `冒险者${character.title}，你的怠惰正在召唤黑暗势力！快振作起来！`,
      `${character.title}，你的自律之盾正在生锈，需要行动来打磨！`,
      `警告！长期不打卡会导致等级停滞，你的敌人正在变强！`,
      `别让你的角色沉睡太久，是时候重新踏上征程了！`,
      `怠惰是最大的敌人，${character.title}，拿起你的武器战斗吧！`,
      `黑暗正在蔓延，${character.title}，你的光芒是唯一的希望！`,
      `今天的懈怠就是明天的遗憾，${character.title}，现在行动！`,
    ];
    return warningQuotes[Math.floor(Math.random() * warningQuotes.length)];
  }

  const encourageQuotes = [
    `勇士${character.title}，你的坚持让黑暗退散！继续前行吧！`,
    `太棒了！${character.title}的意志力正如钢铁般坚不可摧！`,
    `每一滴汗水都是经验的积累，${character.title}正在变强！`,
    `你的自律之剑已经磨得锋利无比，继续保持！`,
    `光芒照耀着${character.title}的道路，坚持就是胜利！`,
    `今天的努力是明天的荣耀，${character.title}，勇往直前！`,
    `Lv.${character.level}的${character.title}，你的传奇正在书写中！`,
    `每一次打卡都是对命运的挑战，${character.title}，你做到了！`,
  ];
  return encourageQuotes[Math.floor(Math.random() * encourageQuotes.length)];
}

export default router;