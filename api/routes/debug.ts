import { Router, Response } from 'express';
import { getDb, getAdjustedTime } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { checkAchievements } from './checkin.js';

const router = Router();
router.use(authMiddleware);

// 保存角色快照
router.post('/snapshot', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    const characterData = JSON.stringify(character);
    const checkinMax = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM checkin_records WHERE user_id = ?').get(req.userId) as any;

    db.prepare(
      'INSERT INTO debug_snapshots (user_id, character_data, checkin_max_id) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET character_data = excluded.character_data, checkin_max_id = excluded.checkin_max_id, created_at = CURRENT_TIMESTAMP'
    ).run(req.userId, characterData, checkinMax.max_id);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '保存快照失败' });
  }
});

// 从快照恢复角色
router.post('/restore', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const snapshot = db.prepare('SELECT * FROM debug_snapshots WHERE user_id = ?').get(req.userId) as any;
    if (!snapshot) {
      res.status(404).json({ success: false, error: '没有找到快照' });
      return;
    }

    // 删除调试模式下新增的打卡记录
    db.prepare('DELETE FROM checkin_records WHERE user_id = ? AND id > ?').run(req.userId, snapshot.checkin_max_id);

    const characterData = JSON.parse(snapshot.character_data);

    db.prepare(
      'UPDATE characters SET level = ?, exp = ?, title = ?, current_streak = ?, max_streak = ?, total_checkins = ? WHERE user_id = ?'
    ).run(
      characterData.level,
      characterData.exp,
      characterData.title,
      characterData.current_streak,
      characterData.max_streak,
      characterData.total_checkins,
      req.userId
    );

    db.prepare('DELETE FROM debug_snapshots WHERE user_id = ?').run(req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '恢复快照失败' });
  }
});

// 直接修改角色属性
router.post('/character', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    const { level, exp, currentStreak, maxStreak, totalCheckins, title } = req.body;

    let newLevel = character.level;
    let newExp = character.exp;
    let newCurrentStreak = character.current_streak;
    let newMaxStreak = character.max_streak;
    let newTotalCheckins = character.total_checkins;
    let newTitle = character.title;

    if (level !== undefined) {
      newLevel = level;
      newExp = level * 100;
    }

    if (exp !== undefined) {
      newExp = exp;
    }

    if (currentStreak !== undefined) {
      newCurrentStreak = currentStreak;
    }

    if (maxStreak !== undefined) {
      newMaxStreak = maxStreak;
    }

    if (totalCheckins !== undefined) {
      newTotalCheckins = totalCheckins;
    }

    if (title !== undefined) {
      newTitle = title;
    }

    db.prepare(
      'UPDATE characters SET level = ?, exp = ?, title = ?, current_streak = ?, max_streak = ?, total_checkins = ? WHERE user_id = ?'
    ).run(newLevel, newExp, newTitle, newCurrentStreak, newMaxStreak, newTotalCheckins, req.userId);

    res.json({
      success: true,
      data: {
        level: newLevel,
        exp: newExp,
        title: newTitle,
        currentStreak: newCurrentStreak,
        maxStreak: newMaxStreak,
        totalCheckins: newTotalCheckins,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '修改角色属性失败' });
  }
});

// 添加测试打卡记录
router.post('/add-checkin', (req: AuthRequest, res: Response) => {
  try {
    const { habitId, daysAgo, expGained } = req.body;
    if (habitId === undefined || daysAgo === undefined || expGained === undefined) {
      res.status(400).json({ success: false, error: '请提供 habitId, daysAgo, expGained' });
      return;
    }

    const offset = req.debugTimeOffset || 0;
    const db = getDb();
    const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(habitId, req.userId) as any;
    if (!habit) {
      res.status(404).json({ success: false, error: '习惯不存在' });
      return;
    }

    const nowSql = getAdjustedTime(offset);

    db.prepare(
      `INSERT INTO checkin_records (user_id, habit_id, exp_gained, checked_at) VALUES (?, ?, ?, ${nowSql}, ?)`
    ).run(req.userId, habitId, expGained, `-${daysAgo} days`);

    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    db.prepare('UPDATE characters SET total_checkins = total_checkins + 1 WHERE user_id = ?').run(req.userId);

    // Trigger achievement check
    const streak = character.current_streak;
    checkAchievements(db, character.id, req.userId!, streak, character.total_checkins + 1, offset);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '添加测试打卡失败' });
  }
});

// 清除所有打卡记录
router.post('/clear-checkins', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM checkin_records WHERE user_id = ?').run(req.userId);
    db.prepare(
      "UPDATE characters SET level = 1, exp = 0, title = '初心者', current_streak = 0, max_streak = 0, total_checkins = 0 WHERE user_id = ?"
    ).run(req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '清除打卡记录失败' });
  }
});

// 解锁指定成就
router.post('/unlock-achievement', (req: AuthRequest, res: Response) => {
  try {
    const { achievementName } = req.body;
    if (!achievementName) {
      res.status(400).json({ success: false, error: '请提供成就名称' });
      return;
    }

    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    const offset = req.debugTimeOffset || 0;
    const nowSql = getAdjustedTime(offset);

    const result = db.prepare(
      `UPDATE achievements SET unlocked_at = ${nowSql} WHERE character_id = ? AND name = ?`
    ).run(character.id, achievementName);

    if (result.changes === 0) {
      res.status(404).json({ success: false, error: '未找到该成就' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '解锁成就失败' });
  }
});

// 重新锁定所有成就
router.post('/relock-achievements', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    db.prepare('UPDATE achievements SET unlocked_at = NULL WHERE character_id = ?').run(character.id);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: '重新锁定成就失败' });
  }
});

export default router;