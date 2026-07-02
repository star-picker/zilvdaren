import { Router, Response } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// 获取圈子列表
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const circles = db.prepare(`
      SELECT c.id, c.name, c.invite_code, c.created_at,
        (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
        cm.role
      FROM circles c
      JOIN circle_members cm ON c.id = cm.circle_id
      WHERE cm.user_id = ?
      ORDER BY c.created_at DESC
    `).all(req.userId);

    const invitations = db.prepare(`
      SELECT ci.id, ci.circle_id, ci.sender_id, ci.status, ci.created_at,
        c.name as circle_name, c.invite_code,
        u.username as sender_username
      FROM circle_invitations ci
      JOIN circles c ON ci.circle_id = c.id
      JOIN users u ON ci.sender_id = u.id
      WHERE ci.receiver_id = ? AND ci.status = 'pending'
      ORDER BY ci.created_at DESC
    `).all(req.userId);

    res.json({ success: true, data: { circles, invitations } });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取圈子列表失败' });
  }
});

// 创建圈子
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: '圈子名称不能为空' });
      return;
    }

    const db = getDb();
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const result = db.prepare(
      'INSERT INTO circles (name, invite_code, creator_id) VALUES (?, ?, ?)'
    ).run(name, inviteCode, req.userId);

    db.prepare(
      "INSERT INTO circle_members (circle_id, user_id, role) VALUES (?, ?, 'creator')"
    ).run(result.lastInsertRowid, req.userId);

    const circle = db.prepare('SELECT * FROM circles WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: circle });
  } catch (error) {
    res.status(500).json({ success: false, error: '创建圈子失败' });
  }
});

// 加入圈子（通过邀请码）
router.post('/join', (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      res.status(400).json({ success: false, error: '邀请码不能为空' });
      return;
    }

    const db = getDb();
    const circle = db.prepare('SELECT * FROM circles WHERE invite_code = ?').get(inviteCode) as any;
    if (!circle) {
      res.status(404).json({ success: false, error: '圈子不存在，请检查邀请码' });
      return;
    }

    const existing = db.prepare(
      'SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(circle.id, req.userId);
    if (existing) {
      res.status(400).json({ success: false, error: '你已经加入了这个圈子' });
      return;
    }

    db.prepare(
      "INSERT INTO circle_members (circle_id, user_id, role) VALUES (?, ?, 'member')"
    ).run(circle.id, req.userId);

    res.json({ success: true, data: circle });
  } catch (error) {
    res.status(500).json({ success: false, error: '加入圈子失败' });
  }
});

// 获取待处理邀请
router.get('/invitations', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const invitations = db.prepare(`
      SELECT ci.id, ci.circle_id, ci.sender_id, ci.status, ci.created_at,
        c.name as circle_name, c.invite_code,
        u.username as sender_username
      FROM circle_invitations ci
      JOIN circles c ON ci.circle_id = c.id
      JOIN users u ON ci.sender_id = u.id
      WHERE ci.receiver_id = ? AND ci.status = 'pending'
      ORDER BY ci.created_at DESC
    `).all(req.userId);

    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取邀请列表失败' });
  }
});

// 拒绝邀请
router.post('/invitations/:id/decline', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const invitation = db.prepare(
      "SELECT * FROM circle_invitations WHERE id = ? AND receiver_id = ? AND status = 'pending'"
    ).get(id, req.userId);
    if (!invitation) {
      res.status(404).json({ success: false, error: '邀请不存在或已处理' });
      return;
    }

    db.prepare("UPDATE circle_invitations SET status = 'declined' WHERE id = ?").run(id);
    res.json({ success: true, message: '已拒绝邀请' });
  } catch (error) {
    res.status(500).json({ success: false, error: '拒绝邀请失败' });
  }
});

// 获取圈子详情
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const circle = db.prepare('SELECT * FROM circles WHERE id = ?').get(id) as any;
    if (!circle) {
      res.status(404).json({ success: false, error: '圈子不存在' });
      return;
    }

    const members = db.prepare(`
      SELECT u.id, u.username, cm.role,
        ch.level, ch.current_streak as streak,
        (SELECT COUNT(*) FROM checkin_records WHERE user_id = u.id AND date(checked_at) = date('now', 'localtime')) as today_checkins
      FROM circle_members cm
      JOIN users u ON cm.user_id = u.id
      JOIN characters ch ON ch.user_id = u.id
      WHERE cm.circle_id = ?
      ORDER BY today_checkins DESC, ch.level DESC
    `).all(id);

    const activities = db.prepare(`
      SELECT ca.*, u.username
      FROM circle_activities ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.circle_id = ?
      ORDER BY ca.checked_at DESC
      LIMIT 20
    `).all(id);

    const invitations = db.prepare(`
      SELECT ci.id, ci.sender_id, ci.receiver_id, ci.status, ci.created_at,
        u.username as receiver_username
      FROM circle_invitations ci
      JOIN users u ON ci.receiver_id = u.id
      WHERE ci.circle_id = ? AND ci.status = 'pending'
      ORDER BY ci.created_at DESC
    `).all(id);

    res.json({
      success: true,
      data: { ...circle, members, activities, invitations },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取圈子详情失败' });
  }
});

// 邀请用户加入圈子
router.post('/:id/invite', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: '缺少用户ID' });
      return;
    }

    const db = getDb();

    const circle = db.prepare('SELECT * FROM circles WHERE id = ?').get(id) as any;
    if (!circle) {
      res.status(404).json({ success: false, error: '圈子不存在' });
      return;
    }

    const myMembership = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, req.userId) as any;
    if (!myMembership || (myMembership.role !== 'creator' && myMembership.role !== 'admin')) {
      res.status(403).json({ success: false, error: '只有创建者或管理员可以邀请成员' });
      return;
    }

    const alreadyMember = db.prepare(
      'SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, userId);
    if (alreadyMember) {
      res.status(400).json({ success: false, error: '该用户已是圈子成员' });
      return;
    }

    const pendingInvitation = db.prepare(
      "SELECT id FROM circle_invitations WHERE circle_id = ? AND receiver_id = ? AND status = 'pending'"
    ).get(id, userId);
    if (pendingInvitation) {
      res.status(400).json({ success: false, error: '已向该用户发送过邀请，等待处理中' });
      return;
    }

    db.prepare(
      "INSERT INTO circle_invitations (circle_id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'pending')"
    ).run(id, req.userId, userId);

    res.json({ success: true, message: '邀请已发送' });
  } catch (error) {
    res.status(500).json({ success: false, error: '邀请用户失败' });
  }
});

// 提升成员为管理员
router.post('/:id/promote', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: '缺少用户ID' });
      return;
    }

    const db = getDb();

    const myMembership = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, req.userId) as any;
    if (!myMembership || myMembership.role !== 'creator') {
      res.status(403).json({ success: false, error: '只有创建者可以提升管理员' });
      return;
    }

    const targetMember = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, userId) as any;
    if (!targetMember) {
      res.status(404).json({ success: false, error: '该用户不是圈子成员' });
      return;
    }
    if (targetMember.role !== 'member') {
      res.status(400).json({ success: false, error: '只能提升普通成员为管理员' });
      return;
    }

    const adminCount = db.prepare(
      "SELECT COUNT(*) as count FROM circle_members WHERE circle_id = ? AND role = 'admin'"
    ).get(id) as any;
    if (adminCount.count >= 3) {
      res.status(400).json({ success: false, error: '管理员数量已达上限（最多3人）' });
      return;
    }

    db.prepare(
      "UPDATE circle_members SET role = 'admin' WHERE circle_id = ? AND user_id = ?"
    ).run(id, userId);

    res.json({ success: true, message: '已提升为管理员' });
  } catch (error) {
    res.status(500).json({ success: false, error: '提升管理员失败' });
  }
});

// 降级管理员为普通成员
router.post('/:id/demote', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: '缺少用户ID' });
      return;
    }

    const db = getDb();

    const myMembership = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, req.userId) as any;
    if (!myMembership || myMembership.role !== 'creator') {
      res.status(403).json({ success: false, error: '只有创建者可以降级管理员' });
      return;
    }

    const targetMember = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, userId) as any;
    if (!targetMember) {
      res.status(404).json({ success: false, error: '该用户不是圈子成员' });
      return;
    }
    if (targetMember.role !== 'admin') {
      res.status(400).json({ success: false, error: '该用户不是管理员' });
      return;
    }

    db.prepare(
      "UPDATE circle_members SET role = 'member' WHERE circle_id = ? AND user_id = ?"
    ).run(id, userId);

    res.json({ success: true, message: '已降级为普通成员' });
  } catch (error) {
    res.status(500).json({ success: false, error: '降级管理员失败' });
  }
});

// 移除成员
router.post('/:id/kick', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: '缺少用户ID' });
      return;
    }

    if (userId === req.userId) {
      res.status(400).json({ success: false, error: '不能移除自己，请使用退出圈子功能' });
      return;
    }

    const db = getDb();

    const myMembership = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, req.userId) as any;
    if (!myMembership) {
      res.status(403).json({ success: false, error: '你不是圈子成员' });
      return;
    }

    const targetMember = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, userId) as any;
    if (!targetMember) {
      res.status(404).json({ success: false, error: '该用户不是圈子成员' });
      return;
    }

    if (myMembership.role === 'creator') {
      // 创建者可以移除任何人
    } else if (myMembership.role === 'admin') {
      if (targetMember.role === 'creator' || targetMember.role === 'admin') {
        res.status(403).json({ success: false, error: '管理员不能移除创建者或其他管理员' });
        return;
      }
    } else {
      res.status(403).json({ success: false, error: '你没有移除成员的权限' });
      return;
    }

    db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true, message: '成员已移除' });
  } catch (error) {
    res.status(500).json({ success: false, error: '移除成员失败' });
  }
});

// 退出圈子
router.post('/:id/leave', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const myMembership = db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).get(id, req.userId) as any;
    if (!myMembership) {
      res.status(404).json({ success: false, error: '你不是圈子成员' });
      return;
    }
    if (myMembership.role === 'creator') {
      res.status(400).json({ success: false, error: '创建者不能退出圈子，请删除圈子' });
      return;
    }

    db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true, message: '已退出圈子' });
  } catch (error) {
    res.status(500).json({ success: false, error: '退出圈子失败' });
  }
});

// 删除圈子
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const circle = db.prepare('SELECT * FROM circles WHERE id = ?').get(id) as any;
    if (!circle) {
      res.status(404).json({ success: false, error: '圈子不存在' });
      return;
    }
    if (circle.creator_id !== req.userId) {
      res.status(403).json({ success: false, error: '只有创建者可以删除圈子' });
      return;
    }

    db.prepare('DELETE FROM circles WHERE id = ?').run(id);
    res.json({ success: true, message: '圈子已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除圈子失败' });
  }
});

export default router;