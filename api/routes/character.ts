import { Router, Response } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { applyMissedCheckinPenalty } from './checkin.js';

const router = Router();
router.use(authMiddleware);

// 获取角色信息
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const offset = req.debugTimeOffset || 0;

    // 检查并应用漏打卡惩罚
    const penalty = applyMissedCheckinPenalty(db, req.userId!, offset);

    const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId) as any;
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
      return;
    }

    const achievements = db.prepare('SELECT * FROM achievements WHERE character_id = ?').all(character.id);
    const expToNext = character.level * 100;

    // 转换字段名 snake_case → camelCase
    const camelAchievements = achievements.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlockedAt: a.unlocked_at,
    }));

    res.json({
      success: true,
      data: {
        id: character.id,
        userId: character.user_id,
        level: character.level,
        exp: character.exp,
        title: character.title,
        currentStreak: character.current_streak,
        maxStreak: character.max_streak,
        totalCheckins: character.total_checkins,
        expToNext,
        achievements: camelAchievements,
        penalty: penalty.penalized ? {
          totalPenalty: penalty.totalPenalty,
          missedHabits: penalty.missedHabits,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取角色信息失败' });
  }
});

export default router;