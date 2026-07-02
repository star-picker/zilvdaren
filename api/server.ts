/**
 * local server entry file, for local development
 */
import 'dotenv/config';
import app from './app.js';
import { initDb } from './db/database.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

async function start() {
  // 初始化数据库（异步加载 WASM）
  await initDb();
  console.log('Database initialized');

  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });

  /**
   * close server
   */
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

start();

export default app;