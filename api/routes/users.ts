import { Router, Response } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 搜索用户
router.get('/search', (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const db = getDb();
    const users = db.prepare(`
      SELECT u.id, u.username, ch.level, ch.title
      FROM users u
      JOIN characters ch ON ch.user_id = u.id
      WHERE u.id != ? AND u.username LIKE ?
      ORDER BY u.username ASC
      LIMIT 10
    `).all(req.userId, `%${q.trim()}%`);

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: '搜索用户失败' });
  }
});

export default router;