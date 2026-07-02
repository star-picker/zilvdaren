import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 修改密码
router.put('/password', (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: '请填写当前密码和新密码' });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ success: false, error: '新密码长度不能少于4位' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      res.status(400).json({ success: false, error: '当前密码错误' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.userId);

    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error) {
    res.status(500).json({ success: false, error: '修改密码失败' });
  }
});

// 设置/修改安全问题
router.put('/security-question', (req: AuthRequest, res: Response) => {
  try {
    const { question, answer, isCustom } = req.body;
    if (!question || !answer) {
      res.status(400).json({ success: false, error: '请填写安全问题和答案' });
      return;
    }
    if (answer.length < 2) {
      res.status(400).json({ success: false, error: '答案长度不能少于2位' });
      return;
    }

    const db = getDb();
    const finalQuestion = isCustom ? question.trim() : question;

    const hashedAnswer = bcrypt.hashSync(answer, 10);
    db.prepare('UPDATE users SET security_question = ?, security_answer = ? WHERE id = ?').run(
      finalQuestion,
      hashedAnswer,
      req.userId
    );

    res.json({ success: true, data: { message: '安全问题设置成功' } });
  } catch (error) {
    res.status(500).json({ success: false, error: '设置安全问题失败' });
  }
});

// 获取当前安全信息
router.get('/security-info', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, security_question, timezone, created_at FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    res.json({
      success: true,
      data: {
        username: user.username,
        hasSecurityQuestion: !!user.security_question,
        securityQuestion: user.security_question || null,
        timezone: user.timezone || 'Asia/Shanghai',
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

// 设置时区
router.put('/timezone', (req: AuthRequest, res: Response) => {
  try {
    const { timezone } = req.body;
    if (!timezone) {
      res.status(400).json({ success: false, error: '请选择时区' });
      return;
    }

    // 验证时区是否有效
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      res.status(400).json({ success: false, error: '无效的时区' });
      return;
    }

    const db = getDb();
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, req.userId);

    res.json({ success: true, data: { timezone } });
  } catch (error) {
    res.status(500).json({ success: false, error: '设置时区失败' });
  }
});

// 注销账户（不可逆）
router.delete('/account', (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ success: false, error: '请输入密码确认注销' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (!bcrypt.compareSync(password, user.password)) {
      res.status(400).json({ success: false, error: '密码错误' });
      return;
    }

    // 删除用户（CASCADE 会删除所有关联数据）
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);

    res.json({ success: true, data: { message: '账户已注销' } });
  } catch (error) {
    res.status(500).json({ success: false, error: '注销账户失败' });
  }
});

export default router;