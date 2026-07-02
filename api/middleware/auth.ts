import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'self-discipline-master-secret-key';

export interface AuthRequest extends Request {
  userId?: number;
  debugMode?: boolean;
  debugTimeOffset?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;

    // Extract debug headers
    req.debugMode = req.headers['x-debug-mode'] === 'true';
    const offsetHeader = req.headers['x-debug-time-offset'];
    req.debugTimeOffset = offsetHeader ? parseInt(offsetHeader as string, 10) || 0 : 0;

    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}