/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getDb } from './db/database.js'
import authRoutes from './routes/auth.js'
import { createAdminRouter } from './routes/auth.js'
import habitRoutes from './routes/habits.js'
import checkinRoutes from './routes/checkin.js'
import characterRoutes from './routes/character.js'
import circleRoutes from './routes/circles.js'
import quoteRoutes from './routes/quotes.js'
import userRoutes from './routes/users.js'
import userCenterRoutes from './routes/user-center.js'
import debugRoutes from './routes/debug.js'
import adminRoutes from './routes/admin.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * 写操作后自动保存数据库到磁盘（sql.js 是内存数据库）
 * 必须在路由之前注册，拦截 res.end
 */
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        getDb().saveToDisk();
      } catch (e) {
        // 初始化阶段忽略
      }
    }
    return originalEnd.apply(res, args);
  } as any;
  next();
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/auth/admin', createAdminRouter())
app.use('/api/habits', habitRoutes)
app.use('/api/checkin', checkinRoutes)
app.use('/api/character', characterRoutes)
app.use('/api/circles', circleRoutes)
app.use('/api/quotes', quoteRoutes)
app.use('/api/users', userRoutes)
app.use('/api/user-center', userCenterRoutes)
app.use('/api/debug', debugRoutes)
app.use('/api/admin', adminRoutes)

/**
 * 生产环境：serve 前端静态文件
 */
// 生产环境静态文件路径：优先使用 __dirname，SEA 模式下回退到 exe 所在目录
const distPath = (() => {
  const regularPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(regularPath)) return regularPath;
  // SEA 模式：使用可执行文件所在目录
  return path.join(path.dirname(process.execPath), 'dist');
})();
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: 所有非 API 路由返回 index.html
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
