import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { generateToken, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// 注册
router.post('/register', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ success: false, error: '密码长度不能少于4位' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    const userId = result.lastInsertRowid as number;

    // 初始化角色
    const charResult = db.prepare('INSERT INTO characters (user_id) VALUES (?)').run(userId);
    const charId = charResult.lastInsertRowid as number;

    // 初始化成就
    const achievements = [
      { name: '初出茅庐', description: '完成首次打卡', icon: 'award' },
      { name: '持之以恒', description: '连续打卡7天', icon: 'flame' },
      { name: '早起达人', description: '连续30天早上7点前打卡', icon: 'sunrise' },
      { name: '全能选手', description: '同时进行5个习惯', icon: 'star' },
      { name: '百天传奇', description: '累计打卡100天', icon: 'crown' },
    ];
    const insertAchievement = db.prepare('INSERT INTO achievements (character_id, name, description, icon) VALUES (?, ?, ?, ?)');
    for (const a of achievements) {
      insertAchievement.run(charId, a.name, a.description, a.icon);
    }

    const token = generateToken(userId);
    const newUser = db.prepare('SELECT timezone, is_admin FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, data: { id: userId, username, token, timezone: newUser?.timezone || 'Asia/Shanghai', isAdmin: !!newUser?.is_admin } });
  } catch (error) {
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

// 登录
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, username, password, timezone, is_admin FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      res.status(400).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    if (!bcrypt.compareSync(password, user.password)) {
      res.status(400).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const token = generateToken(user.id);
    res.json({ success: true, data: { id: user.id, username: user.username, token, timezone: user.timezone || 'Asia/Shanghai', isAdmin: !!user.is_admin } });
  } catch (error) {
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

// 获取用户的安全问题（用于忘记密码流程）
router.get('/security-question', (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
      res.status(400).json({ success: false, error: '请提供用户名' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, security_question FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      res.status(400).json({ success: false, error: '用户名不存在' });
      return;
    }
    if (!user.security_question) {
      res.status(400).json({ success: false, error: '该用户未设置安全问题' });
      return;
    }

    res.json({ success: true, data: { userId: user.id, question: user.security_question } });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取安全问题失败' });
  }
});

// 验证安全问题答案（带限流防暴力破解）
router.post('/verify-answer', (req: Request, res: Response) => {
  try {
    const { username, answer } = req.body;
    if (!username || !answer) {
      res.status(400).json({ success: false, error: '请提供用户名和答案' });
      return;
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, security_answer, failed_attempts, last_failed_at, locked_until FROM users WHERE username = ?'
    ).get(username) as any;
    if (!user) {
      res.status(400).json({ success: false, error: '用户名不存在' });
      return;
    }
    if (!user.security_answer) {
      res.status(400).json({ success: false, error: '该用户未设置安全问题' });
      return;
    }

    const now = new Date();
    const nowStr = now.toISOString();

    // 检查是否被锁定
    if (user.locked_until) {
      const lockUntil = new Date(user.locked_until);
      if (now < lockUntil) {
        const remainingSeconds = Math.ceil((lockUntil.getTime() - now.getTime()) / 1000);
        const remainingMin = Math.ceil(remainingSeconds / 60);
        res.status(429).json({
          success: false,
          error: `尝试次数过多，请等待 ${remainingMin} 分钟后再试`,
          lockedUntil: user.locked_until,
          remainingSeconds,
        });
        return;
      }
      // 锁定已过期，重置计数
      db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
      user.failed_attempts = 0;
    }

    // 检查答案
    if (!bcrypt.compareSync(answer, user.security_answer)) {
      const newAttempts = user.failed_attempts + 1;
      const isWithinWindow = user.last_failed_at
        ? (now.getTime() - new Date(user.last_failed_at).getTime()) < 60000 // 1分钟内
        : true;

      if (isWithinWindow && newAttempts >= 3) {
        // 锁定5分钟
        const lockUntil = new Date(now.getTime() + 5 * 60 * 1000);
        db.prepare(
          'UPDATE users SET failed_attempts = ?, last_failed_at = ?, locked_until = ? WHERE id = ?'
        ).run(newAttempts, nowStr, lockUntil.toISOString(), user.id);
        res.status(429).json({
          success: false,
          error: '安全问题答案错误，已锁定 5 分钟',
          lockedUntil: lockUntil.toISOString(),
          remainingSeconds: 300,
        });
      } else {
        // 递增失败次数
        db.prepare(
          'UPDATE users SET failed_attempts = ?, last_failed_at = ? WHERE id = ?'
        ).run(newAttempts, nowStr, user.id);
        const remaining = 3 - newAttempts;
        res.status(400).json({
          success: false,
          error: `安全问题答案错误，还剩 ${remaining} 次机会`,
          remainingAttempts: remaining,
        });
      }
      return;
    }

    // 答案正确，重置失败计数
    db.prepare('UPDATE users SET failed_attempts = 0, last_failed_at = NULL, locked_until = NULL WHERE id = ?').run(user.id);

    res.json({ success: true, data: { verified: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: '验证失败' });
  }
});

// 通过安全问题重置密码
router.post('/reset-password', (req: Request, res: Response) => {
  try {
    const { username, answer, newPassword } = req.body;
    if (!username || !answer || !newPassword) {
      res.status(400).json({ success: false, error: '请填写所有字段' });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ success: false, error: '新密码长度不能少于4位' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, security_answer, locked_until FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      res.status(400).json({ success: false, error: '用户名不存在' });
      return;
    }
    if (!user.security_answer) {
      res.status(400).json({ success: false, error: '该用户未设置安全问题' });
      return;
    }

    // 检查锁定状态
    if (user.locked_until) {
      const now = new Date();
      if (now < new Date(user.locked_until)) {
        const remainingMin = Math.ceil((new Date(user.locked_until).getTime() - now.getTime()) / 60000);
        res.status(429).json({ success: false, error: `账户已锁定，请等待 ${remainingMin} 分钟后再试` });
        return;
      }
    }

    if (!bcrypt.compareSync(answer, user.security_answer)) {
      res.status(400).json({ success: false, error: '安全问题答案错误' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hashedPassword, user.id);

    res.json({ success: true, data: { message: '密码重置成功，请使用新密码登录' } });
  } catch (error) {
    res.status(500).json({ success: false, error: '重置密码失败' });
  }
});

// 通过 token 获取当前用户信息（用于 URL token 登录）
router.get('/me', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: '未提供有效的 token' });
      return;
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const db = getDb();
    const user = db.prepare('SELECT id, username, is_admin, timezone FROM users WHERE id = ?').get(decoded.userId) as any;
    if (!user) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true, data: { id: user.id, username: user.username, isAdmin: !!user.is_admin, timezone: user.timezone || 'Asia/Shanghai' } });
  } catch (error) {
    res.status(401).json({ success: false, error: 'token 无效或已过期' });
  }
});

export default router;

// ─── 管理员注册（隐藏接口，需管理密钥） ───
const ADMIN_REGISTER_KEY = 'admin-init-key-2026';

export function createAdminRouter() {
  const adminRouter = Router();

  adminRouter.post('/register', (req: Request, res: Response) => {
    try {
      const { username, password, adminKey } = req.body;
      if (!username || !password || !adminKey) {
        res.status(400).json({ success: false, error: '请填写所有字段' });
        return;
      }
      if (adminKey !== ADMIN_REGISTER_KEY) {
        res.status(403).json({ success: false, error: '管理员注册密钥错误' });
        return;
      }
      if (password.length < 4) {
        res.status(400).json({ success: false, error: '密码长度不能少于4位' });
        return;
      }

      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        res.status(400).json({ success: false, error: '用户名已存在' });
        return;
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare(
        'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)'
      ).run(username, hashedPassword);
      const userId = result.lastInsertRowid as number;

      const charResult = db.prepare('INSERT INTO characters (user_id) VALUES (?)').run(userId);
      const charId = charResult.lastInsertRowid as number;

      const achievements = [
        { name: '初出茅庐', description: '完成首次打卡', icon: 'award' },
        { name: '持之以恒', description: '连续打卡7天', icon: 'flame' },
        { name: '早起达人', description: '连续30天早上7点前打卡', icon: 'sunrise' },
        { name: '全能选手', description: '同时进行5个习惯', icon: 'star' },
        { name: '百天传奇', description: '累计打卡100天', icon: 'crown' },
      ];
      const insertAchievement = db.prepare('INSERT INTO achievements (character_id, name, description, icon) VALUES (?, ?, ?, ?)');
      for (const a of achievements) {
        insertAchievement.run(charId, a.name, a.description, a.icon);
      }

      const token = generateToken(userId);
      res.json({ success: true, data: { id: userId, username, token, timezone: 'Asia/Shanghai', isAdmin: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: '注册失败' });
    }
  });

  return adminRouter;
}