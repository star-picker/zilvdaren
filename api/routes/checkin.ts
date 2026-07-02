import { Router, Response } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { generateQuote } from './quotes.js';

const router = Router();
router.use(authMiddleware);

const EXP_PER_DIFFICULTY = [0, 10, 20, 30, 50, 80];
const STREAK_TITLES: [number, string, number][] = [
  [100, '自律传说', 1000],
  [60, '自律大师', 500],
  [30, '自律达人', 200],
  [14, '自律新星', 100],
  [7, '持之以恒', 50],
];

/**
 * 检查并应用漏打卡惩罚
 * 每次获取角色数据时调用，每个自然日只执行一次
 */
export function applyMissedCheckinPenalty(db: any, userId: number, offsetSeconds: number = 0): { penalized: boolean; totalPenalty: number; missedHabits: string[] } {
  const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(userId) as any;
  if (!character) return { penalized: false, totalPenalty: 0, missedHabits: [] };

  const sign = offsetSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(offsetSeconds);
  const offsetSuffix = offsetSeconds === 0 ? '' : `, '${sign}${abs} seconds'`;

  // 获取今天的日期（考虑调试偏移）
  const todayRow = db.prepare(`SELECT date(datetime('now', 'localtime'${offsetSuffix})) as d`).get() as any;
  const todayStr = todayRow.d;

  // 如果今天已经检查过惩罚，跳过
  if (character.last_penalty_date === todayStr) {
    return { penalized: false, totalPenalty: 0, missedHabits: [] };
  }

  // 获取昨天的日期
  const yesterdayRow = db.prepare(`SELECT date(datetime('now', 'localtime', '-1 day'${offsetSuffix})) as d`).get() as any;
  const yesterdayStr = yesterdayRow.d;

  // 检查用户创建时间：如果用户是今天或昨天创建的，跳过惩罚
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId) as any;
  if (user && user.created_at) {
    const userCreatedDate = db.prepare(`SELECT date(?) as d`).get(user.created_at) as any;
    if (userCreatedDate.d >= yesterdayStr) {
      // 用户创建于昨天或之后，不需要惩罚
      db.prepare('UPDATE characters SET last_penalty_date = ? WHERE user_id = ?').run(todayStr, userId);
      return { penalized: false, totalPenalty: 0, missedHabits: [] };
    }
  }

  // 获取所有每日习惯
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? AND frequency = ?').all(userId, 'daily') as any[];

  if (habits.length === 0) {
    // 更新检查日期，避免后续重复检查
    db.prepare('UPDATE characters SET last_penalty_date = ? WHERE user_id = ?').run(todayStr, userId);
    return { penalized: false, totalPenalty: 0, missedHabits: [] };
  }

  // 检查昨天有哪些习惯已打卡
  const yesterdayCheckins = db.prepare(`
    SELECT DISTINCT habit_id FROM checkin_records
    WHERE user_id = ? AND date(checked_at) = ?
  `).all(userId, yesterdayStr) as any[];

  const checkedIds = new Set(yesterdayCheckins.map((c: any) => c.habit_id));

  // 找到漏打卡的习惯
  const missedHabits = habits.filter((h: any) => !checkedIds.has(h.id));
  if (missedHabits.length === 0) {
    db.prepare('UPDATE characters SET last_penalty_date = ? WHERE user_id = ?').run(todayStr, userId);
    return { penalized: false, totalPenalty: 0, missedHabits: [] };
  }

  // 计算总惩罚EXP
  let totalPenalty = 0;
  const missedNames: string[] = [];
  for (const h of missedHabits) {
    const penalty = Math.floor(EXP_PER_DIFFICULTY[h.difficulty] / 2);
    totalPenalty += penalty;
    missedNames.push(h.name);
  }

  // 应用惩罚：扣除EXP，最低0，不降级
  let newExp = Math.max(0, character.exp - totalPenalty);
  let newLevel = character.level;
  // 重新计算等级（EXP减少可能导致降级）
  while (newLevel > 1) {
    const expForPrevLevel = (newLevel - 1) * 100;
    if (newExp < expForPrevLevel) {
      newLevel--;
      newExp = Math.max(0, newExp);
    } else {
      break;
    }
  }

  // 中断连续打卡
  const newStreak = 0;

  db.prepare(
    'UPDATE characters SET exp = ?, level = ?, current_streak = ?, last_penalty_date = ? WHERE user_id = ?'
  ).run(newExp, newLevel, newStreak, todayStr, userId);

  return { penalized: true, totalPenalty, missedHabits: missedNames };
}

/** Build SQL date expression with debug time offset */
function dateSql(base: string, offsetSeconds: number): string {
  if (offsetSeconds === 0) return base;
  const sign = offsetSeconds >= 0 ? '+' : '-';
  return `datetime('now', 'localtime', '${sign}${Math.abs(offsetSeconds)} seconds')`;
}

/** Build "today" SQL expression */
function todaySql(offsetSeconds: number): string {
  return dateSql("datetime('now', 'localtime')", offsetSeconds);
}

/** Build "yesterday" SQL expression */
function yesterdaySql(offsetSeconds: number): string {
  if (offsetSeconds === 0) return "datetime('now', 'localtime', '-1 day')";
  const sign = offsetSeconds >= 0 ? '+' : '-';
  return `datetime('now', 'localtime', '-1 day', '${sign}${Math.abs(offsetSeconds)} seconds')`;
}

// 打卡
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { habitId } = req.body;
    const offset = req.debugTimeOffset || 0;
    if (!habitId) {
      res.status(400).json({ success: false, error: '请指定习惯' });
      return;
    }

    const db = getDb();
    const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.userId) as any;
    if (!habit) {
      res.status(404).json({ success: false, error: '习惯不存在' });
      return;
    }

    // 检查今天是否已打卡
    const todayCheck = db.prepare(
      `SELECT id FROM checkin_records WHERE habit_id = ? AND user_id = ? AND date(checked_at) = date(${todaySql(offset)})`
    ).get(habitId, req.userId);
    if (todayCheck) {
      res.status(400).json({ success: false, error: '今天已经打卡过了' });
      return;
    }

    const expGained = EXP_PER_DIFFICULTY[habit.difficulty];

    // 插入打卡记录
    db.prepare(
      'INSERT INTO checkin_records (user_id, habit_id, exp_gained) VALUES (?, ?, ?)'
    ).run(req.userId, habitId, expGained);

    // 更新角色
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    let newExp = character.exp + expGained;
    let newLevel = character.level;
    let leveledUp = false;
    let newTitle = character.title;

    // 检查升级
    const expToNext = newLevel * 100;
    while (newExp >= expToNext) {
      newExp -= expToNext;
      newLevel++;
      leveledUp = true;
    }

    // 计算连续打卡天数
    const yesterday = db.prepare(
      `SELECT DISTINCT date(checked_at) as d FROM checkin_records WHERE user_id = ? AND date(checked_at) = date(${yesterdaySql(offset)})`
    ).get(req.userId);
    const todayHasOther = db.prepare(
      `SELECT id FROM checkin_records WHERE user_id = ? AND id != last_insert_rowid() AND date(checked_at) = date(${todaySql(offset)})`
    ).get(req.userId);

    let currentStreak = character.current_streak;
    if (yesterday && !todayHasOther) {
      currentStreak++;
    } else if (!todayHasOther) {
      currentStreak = 1;
    }

    const maxStreak = Math.max(character.max_streak, currentStreak);

    // 检查连续打卡称号
    let bonusExp = 0;
    for (const [days, title, bonus] of STREAK_TITLES) {
      if (currentStreak >= days && !character.title.includes(title)) {
        newTitle = title;
        bonusExp = bonus;
        newExp += bonus;
        break;
      }
    }

    db.prepare(
      'UPDATE characters SET level = ?, exp = ?, title = ?, current_streak = ?, max_streak = ?, total_checkins = total_checkins + 1 WHERE user_id = ?'
    ).run(newLevel, newExp, newTitle, currentStreak, maxStreak, req.userId);

    // 检查成就解锁
    const charId = character.id;
    checkAchievements(db, charId, req.userId!, currentStreak, character.total_checkins + 1, offset);

    // 记录圈子动态
    const circleMemberships = db.prepare(
      'SELECT circle_id FROM circle_members WHERE user_id = ?'
    ).all(req.userId) as any[];
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as any;
    for (const cm of circleMemberships) {
      db.prepare(
        'INSERT INTO circle_activities (circle_id, user_id, habit_name) VALUES (?, ?, ?)'
      ).run(cm.circle_id, req.userId, habit.name);
    }

    // 自动生成AI语录
    let quote: { content: string; type: 'encourage' | 'warning' } | null = null;
    try {
      quote = await generateQuote(db, req.userId!, character);
      if (quote) {
        db.prepare(
          'INSERT INTO quotes (user_id, content, type) VALUES (?, ?, ?)'
        ).run(req.userId, quote.content, quote.type);
      }
    } catch (e) {
      console.error('Auto quote generation failed:', e);
    }

    res.json({
      success: true,
      data: {
        expGained: expGained + bonusExp,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined,
        newTitle: newTitle !== character.title ? newTitle : undefined,
        currentStreak,
        quote: quote || undefined,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '打卡失败' });
  }
});

// 今日打卡状态
router.get('/today', (req: AuthRequest, res: Response) => {
  try {
    const offset = req.debugTimeOffset || 0;
    const db = getDb();
    const habits = db.prepare('SELECT id FROM habits WHERE user_id = ?').all(req.userId) as any[];
    const todayChecks = db.prepare(
      `SELECT habit_id FROM checkin_records WHERE user_id = ? AND date(checked_at) = date(${todaySql(offset)})`
    ).all(req.userId) as any[];

    const checkedIds = new Set(todayChecks.map((c: any) => c.habit_id));
    const result = habits.map((h: any) => ({ habitId: h.id, checked: checkedIds.has(h.id) }));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取打卡状态失败' });
  }
});

// 打卡记录
router.get('/records', (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.query;
    const db = getDb();
    let records: any[];
    if (year && month) {
      const y = parseInt(year as string);
      const m = parseInt(month as string);
      records = db.prepare(`
        SELECT cr.*, h.name as habit_name, h.icon as habit_icon
        FROM checkin_records cr
        JOIN habits h ON cr.habit_id = h.id
        WHERE cr.user_id = ? AND strftime('%Y', cr.checked_at) = ? AND strftime('%m', cr.checked_at) = ?
        ORDER BY cr.checked_at DESC
      `).all(req.userId, String(y).padStart(4, '0'), String(m).padStart(2, '0'));
    } else {
      records = db.prepare(`
        SELECT cr.*, h.name as habit_name, h.icon as habit_icon
        FROM checkin_records cr
        JOIN habits h ON cr.habit_id = h.id
        WHERE cr.user_id = ?
        ORDER BY cr.checked_at DESC
        LIMIT 50
      `).all(req.userId);
    }
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取打卡记录失败' });
  }
});

export function checkAchievements(db: any, charId: number, userId: number, streak: number, totalCheckins: number, offsetSeconds: number = 0) {
  const nowSql = offsetSeconds === 0 ? "datetime('now', 'localtime')" : `datetime('now', 'localtime', '${offsetSeconds >= 0 ? '+' : '-'}${Math.abs(offsetSeconds)} seconds')`;
  // 初出茅庐 - 首次打卡
  if (totalCheckins === 1) {
    db.prepare(`UPDATE achievements SET unlocked_at = ${nowSql} WHERE character_id = ? AND name = '初出茅庐' AND unlocked_at IS NULL`).run(charId);
  }
  // 持之以恒 - 连续7天
  if (streak >= 7) {
    db.prepare(`UPDATE achievements SET unlocked_at = ${nowSql} WHERE character_id = ? AND name = '持之以恒' AND unlocked_at IS NULL`).run(charId);
  }
  // 百天传奇 - 累计100天
  if (totalCheckins >= 100) {
    db.prepare(`UPDATE achievements SET unlocked_at = ${nowSql} WHERE character_id = ? AND name = '百天传奇' AND unlocked_at IS NULL`).run(charId);
  }
  // 全能选手 - 5个习惯
  const habitCount = db.prepare('SELECT COUNT(*) as count FROM habits WHERE user_id = ?').get(userId) as any;
  if (habitCount.count >= 5) {
    db.prepare(`UPDATE achievements SET unlocked_at = ${nowSql} WHERE character_id = ? AND name = '全能选手' AND unlocked_at IS NULL`).run(charId);
  }
}

export default router;