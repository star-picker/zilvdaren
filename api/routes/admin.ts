import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, getSetting, setSetting } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// 管理员中间件
function adminMiddleware(req: AuthRequest, res: Response, next: Function) {
  const db = getDb();
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !user.is_admin) {
    res.status(403).json({ success: false, error: '无管理员权限' });
    return;
  }
  next();
}

router.use(authMiddleware);
router.use(adminMiddleware);

// ─── 用户管理 ───

// 获取所有用户列表
router.get('/users', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT u.id, u.username, u.is_admin, u.timezone, u.created_at,
        ch.level, ch.exp, ch.title, ch.current_streak, ch.max_streak, ch.total_checkins,
        (SELECT COUNT(*) FROM habits WHERE user_id = u.id) as habit_count,
        (SELECT COUNT(*) FROM checkin_records WHERE user_id = u.id) as checkin_count,
        (SELECT COUNT(*) FROM circle_members WHERE user_id = u.id) as circle_count
      FROM users u
      LEFT JOIN characters ch ON ch.user_id = u.id
      ORDER BY u.id
    `).all() as any[];
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// 获取单个用户详细数据
router.get('/users/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare(`
      SELECT u.*, ch.level, ch.exp, ch.title, ch.current_streak, ch.max_streak, ch.total_checkins
      FROM users u
      LEFT JOIN characters ch ON ch.user_id = u.id
      WHERE u.id = ?
    `).get(id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(id);
    const checkins = db.prepare(
      'SELECT * FROM checkin_records WHERE user_id = ? ORDER BY checked_at DESC LIMIT 100'
    ).all(id);
    const achievements = db.prepare(`
      SELECT a.* FROM achievements a
      JOIN characters ch ON a.character_id = ch.id
      WHERE ch.user_id = ?
    `).all(id);
    const circles = db.prepare(`
      SELECT c.name, cm.role FROM circles c
      JOIN circle_members cm ON c.id = cm.circle_id
      WHERE cm.user_id = ?
    `).all(id);

    res.json({
      success: true,
      data: {
        user,
        habits,
        checkins,
        achievements,
        circles,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户数据失败' });
  }
});

// 重置用户密码为其用户名
router.post('/users/:id/reset-password', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const newPassword = user.username;
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, id);

    res.json({ success: true, message: `密码已重置为用户名 "${newPassword}"` });
  } catch (error) {
    res.status(500).json({ success: false, error: '重置密码失败' });
  }
});

// 重置用户密保问题
router.post('/users/:id/reset-security', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    db.prepare(
      'UPDATE users SET security_question = NULL, security_answer = NULL, failed_attempts = 0, locked_until = NULL WHERE id = ?'
    ).run(id);

    res.json({ success: true, message: '密保问题已清除' });
  } catch (error) {
    res.status(500).json({ success: false, error: '重置密保失败' });
  }
});

// 强制删除用户
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    if (user.is_admin) {
      res.status(400).json({ success: false, error: '不能删除管理员账户' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除用户失败' });
  }
});

// 重置用户角色数据
router.post('/users/:id/reset-character', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    // 重置角色属性
    const char = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(id) as any;
    if (char) {
      db.prepare(`
        UPDATE characters SET level = 1, exp = 0, title = '初心者',
        current_streak = 0, max_streak = 0, total_checkins = 0, last_penalty_date = NULL
        WHERE user_id = ?
      `).run(id);

      // 重置成就
      db.prepare('DELETE FROM achievements WHERE character_id = ?').run(char.id);
      const achievements = [
        { name: '初出茅庐', description: '完成首次打卡', icon: 'award' },
        { name: '持之以恒', description: '连续打卡7天', icon: 'flame' },
        { name: '早起达人', description: '连续30天早上7点前打卡', icon: 'sunrise' },
        { name: '全能选手', description: '同时进行5个习惯', icon: 'star' },
        { name: '百天传奇', description: '累计打卡100天', icon: 'crown' },
      ];
      const insert = db.prepare('INSERT INTO achievements (character_id, name, description, icon) VALUES (?, ?, ?, ?)');
      for (const a of achievements) {
        insert.run(char.id, a.name, a.description, a.icon);
      }
    }

    // 删除所有打卡记录
    db.prepare('DELETE FROM checkin_records WHERE user_id = ?').run(id);
    // 删除语录
    db.prepare('DELETE FROM quotes WHERE user_id = ?').run(id);
    // 清除调试快照
    db.prepare('DELETE FROM debug_snapshots WHERE user_id = ?').run(id);

    res.json({ success: true, message: '用户角色数据已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: '重置角色数据失败' });
  }
});

// ─── 设置管理 ───

// 获取所有设置
router.get('/settings', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings').all();
    const apiKey = getSetting('DEEPSEEK_API_KEY');
    res.json({
      success: true,
      data: {
        settings,
        apiKey: apiKey || '',
        hasApiKey: !!apiKey,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取设置失败' });
  }
});

// 更新设置
router.put('/settings', (req: AuthRequest, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (apiKey !== undefined) {
      setSetting('DEEPSEEK_API_KEY', apiKey as string);
    }
    res.json({ success: true, message: '设置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: '保存设置失败' });
  }
});

export default router;