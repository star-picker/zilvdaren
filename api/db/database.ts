import initSqlJs, { Database as SqlJsDb, Statement as SqlJsStmt, SqlJsStatic } from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 读取 sql.js WASM 文件路径
function getWasmBuffer(): Buffer {
  const wasmPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'
  );
  return fs.readFileSync(wasmPath);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app.db');

let dbInstance: Database | null = null;

// ─── sql.js 包装层：模拟 better-sqlite3 API ───

class Statement {
  private stmt: SqlJsStmt;
  private sqlJsDb: SqlJsDb;

  constructor(sqlJsDb: SqlJsDb, stmt: SqlJsStmt) {
    this.sqlJsDb = sqlJsDb;
    this.stmt = stmt;
  }

  get(...params: any[]): any | undefined {
    if (params.length > 0) this.stmt.bind(params);
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject();
      this.stmt.reset();
      return row;
    }
    this.stmt.reset();
    return undefined;
  }

  all(...params: any[]): any[] {
    if (params.length > 0) this.stmt.bind(params);
    const results: any[] = [];
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return results;
  }

  run(...params: any[]): { lastInsertRowid: number; changes: number } {
    if (params.length > 0) this.stmt.bind(params);
    this.stmt.step();
    this.stmt.reset();

    // 获取 lastInsertRowid
    const lastIdResult = this.sqlJsDb.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = (lastIdResult.length > 0 && lastIdResult[0].values.length > 0)
      ? (lastIdResult[0].values[0][0] as number)
      : 0;

    // 获取 changes
    const changesResult = this.sqlJsDb.exec('SELECT changes()');
    const changes = (changesResult.length > 0 && changesResult[0].values.length > 0)
      ? (changesResult[0].values[0][0] as number)
      : 0;

    return { lastInsertRowid, changes };
  }
}

class Database {
  private sqlJsDb: SqlJsDb;
  private filePath: string;

  constructor(sqlJsDb: SqlJsDb, filePath: string) {
    this.sqlJsDb = sqlJsDb;
    this.filePath = filePath;
    // 启用外键约束
    this.sqlJsDb.run('PRAGMA foreign_keys = ON');
  }

  prepare(sql: string): Statement {
    const stmt = this.sqlJsDb.prepare(sql);
    return new Statement(this.sqlJsDb, stmt);
  }

  exec(sql: string): void {
    this.sqlJsDb.run(sql);
  }

  /** 保存数据库到磁盘 */
  saveToDisk(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = this.sqlJsDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.filePath, buffer);
  }
}

// ─── 单例入口 ───

let SQL: SqlJsStatic | null = null;

/** 异步初始化数据库（加载 WASM、读取文件） */
export async function initDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const wasmBinary = getWasmBuffer();
  SQL = await initSqlJs({ wasmBinary });

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let sqlJsDb: SqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  dbInstance = new Database(sqlJsDb, DB_PATH);
  initializeSchema();
  runMigrations();
  dbInstance.saveToDisk();
  return dbInstance;
}

/** 同步获取已初始化的数据库实例（必须在 initDb() 完成后调用） */
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

// ─── Schema 初始化 ───

function initializeSchema() {
  const db = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  // sql.js 的 run 支持单条语句，多条需要分开或用 exec
  // 用 exec 执行多条语句（sql.js 的 SqlJsDb.exec 返回结果数组，但这里不需要结果）
  const sqlJsDb = (db as any).sqlJsDb as SqlJsDb;
  sqlJsDb.exec(schema);
}

function runMigrations() {
  const db = getDb();
  const sqlJsDb = (db as any).sqlJsDb as SqlJsDb;

  // Add role column to existing circle_members if not present
  const hasRole = sqlJsDb.exec("PRAGMA table_info(circle_members)");
  const roleCols = hasRole.length > 0 ? hasRole[0].values : [];
  if (!roleCols.some((c: any) => c[1] === 'role')) {
    sqlJsDb.run("ALTER TABLE circle_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('creator', 'admin', 'member'))");
    sqlJsDb.run("UPDATE circle_members SET role = 'creator' WHERE id IN (SELECT cm.id FROM circle_members cm JOIN circles c ON cm.circle_id = c.id WHERE cm.user_id = c.creator_id)");
  }

  // Add checkin_max_id to debug_snapshots if not present
  const snapCols = sqlJsDb.exec("PRAGMA table_info(debug_snapshots)");
  const snapVals = snapCols.length > 0 ? snapCols[0].values : [];
  if (!snapVals.some((c: any) => c[1] === 'checkin_max_id')) {
    sqlJsDb.run("ALTER TABLE debug_snapshots ADD COLUMN checkin_max_id INTEGER NOT NULL DEFAULT 0");
  }

  // Add last_penalty_date to characters if not present
  const charCols = sqlJsDb.exec("PRAGMA table_info(characters)");
  const charVals = charCols.length > 0 ? charCols[0].values : [];
  if (!charVals.some((c: any) => c[1] === 'last_penalty_date')) {
    sqlJsDb.run("ALTER TABLE characters ADD COLUMN last_penalty_date TEXT");
  }

  // Add security_question and security_answer to users if not present
  const userCols = sqlJsDb.exec("PRAGMA table_info(users)");
  const userVals = userCols.length > 0 ? userCols[0].values : [];
  if (!userVals.some((c: any) => c[1] === 'security_question')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN security_question TEXT");
  }
  if (!userVals.some((c: any) => c[1] === 'security_answer')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN security_answer TEXT");
  }
  if (!userVals.some((c: any) => c[1] === 'failed_attempts')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0");
  }
  if (!userVals.some((c: any) => c[1] === 'last_failed_at')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN last_failed_at DATETIME");
  }
  if (!userVals.some((c: any) => c[1] === 'locked_until')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN locked_until DATETIME");
  }
  if (!userVals.some((c: any) => c[1] === 'timezone')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'");
  }

  // Add is_admin column to users if not present
  if (!userVals.some((c: any) => c[1] === 'is_admin')) {
    sqlJsDb.run("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }

  // Create settings table if not exists
  const settingsExists = sqlJsDb.exec("PRAGMA table_info(settings)");
  if (settingsExists.length === 0) {
    sqlJsDb.run("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    // Migrate existing API key from .env to database
    // The migration will happen at runtime
  }

  // Initialize achievements for existing characters that don't have any
  const charsWithoutAchievements = db.prepare(`
    SELECT c.id FROM characters c
    WHERE NOT EXISTS (SELECT 1 FROM achievements a WHERE a.character_id = c.id)
  `).all() as any[];

  if (charsWithoutAchievements.length > 0) {
    const achievements = [
      { name: '初出茅庐', description: '完成首次打卡', icon: 'award' },
      { name: '持之以恒', description: '连续打卡7天', icon: 'flame' },
      { name: '早起达人', description: '连续30天早上7点前打卡', icon: 'sunrise' },
      { name: '全能选手', description: '同时进行5个习惯', icon: 'star' },
      { name: '百天传奇', description: '累计打卡100天', icon: 'crown' },
    ];
    const insert = db.prepare('INSERT INTO achievements (character_id, name, description, icon) VALUES (?, ?, ?, ?)');
    for (const char of charsWithoutAchievements) {
      for (const a of achievements) {
        insert.run(char.id, a.name, a.description, a.icon);
      }
    }
  }
}

/**
 * Get the current datetime adjusted by debug time offset (in seconds)
 */
export function getAdjustedTime(offsetSeconds: number = 0): string {
  if (offsetSeconds === 0) {
    return "datetime('now', 'localtime')";
  }
  const sign = offsetSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(offsetSeconds);
  return `datetime('now', 'localtime', '${sign}${abs} seconds')`;
}

// ─── Settings helpers ───

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, value);
}

export function getApiKey(): string | null {
  // 优先从数据库读取，fallback 到 .env
  const dbKey = getSetting('DEEPSEEK_API_KEY');
  if (dbKey) return dbKey;
  return process.env.DEEPSEEK_API_KEY || null;
}