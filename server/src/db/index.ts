import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.DATABASE_URL ?? './data/nav.db';
const resolvedPath = path.resolve(dbPath);

// 确保 data 目录存在
const dataDir = path.dirname(resolvedPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(resolvedPath);
// 开启 WAL 模式，提升并发性能
sqlite.pragma('journal_mode = WAL');
// 开启外键约束
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };

// 自动执行数据库迁移（drizzle-kit generate 生成的迁移文件）
const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
if (fs.existsSync(migrationsFolder)) {
  try {
    migrate(db, { migrationsFolder });
    console.log(`✓ 数据库迁移完成 (${dbPath})`);
  } catch (e) {
    console.error('× 数据库迁移失败:', e);
    process.exit(1);
  }
}
