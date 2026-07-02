import { Router, Response } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 获取所有习惯
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const habits = db.prepare(`
      SELECT h.*, 
        (SELECT COUNT(*) FROM checkin_records WHERE habit_id = h.id AND date(checked_at) = date('now', 'localtime')) as checked_today
      FROM habits h 
      WHERE h.user_id = ? 
      ORDER BY h.created_at DESC
    `).all(req.userId);
    res.json({ success: true, data: habits });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取习惯列表失败' });
  }
});

// 创建习惯
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, icon, difficulty, frequency, reminderTime } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: '习惯名称不能为空' });
      return;
    }

    const db = getDb();
    const result = db.prepare(
      'INSERT INTO habits (user_id, name, icon, difficulty, frequency, reminder_time) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.userId, name, icon || 'target', difficulty || 1, frequency || 'daily', reminderTime || null);

    const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: habit });
  } catch (error) {
    res.status(500).json({ success: false, error: '创建习惯失败' });
  }
});

// 更新习惯
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, difficulty, frequency, reminderTime } = req.body;

    const db = getDb();
    const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
    if (!habit) {
      res.status(404).json({ success: false, error: '习惯不存在' });
      return;
    }

    db.prepare(
      'UPDATE habits SET name = ?, icon = ?, difficulty = ?, frequency = ?, reminder_time = ? WHERE id = ? AND user_id = ?'
    ).run(
      name || habit.name,
      icon || habit.icon,
      difficulty || habit.difficulty,
      frequency || habit.frequency,
      reminderTime !== undefined ? reminderTime : habit.reminder_time,
      id,
      req.userId
    );

    const updated = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新习惯失败' });
  }
});

// 删除习惯
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(id, req.userId);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: '习惯不存在' });
      return;
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除习惯失败' });
  }
});

export default router;