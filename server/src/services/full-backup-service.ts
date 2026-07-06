import { db, sqlite } from '../db/index.ts';
import {
  categories as categoriesTable, bookmarks as bookmarksTable,
  todos as todosTable, notes as notesTable, settings as settingsTable,
  monitorTargets as monitorTargetsTable,
} from '../db/schema.ts';
import { asc, desc } from 'drizzle-orm';

/** 全量备份结构（包含监控目标） */
export interface FullBackup {
  version: 1;
  exportedAt: number;
  settings: Record<string, string>;
  categories: Array<typeof categoriesTable.$inferSelect>;
  bookmarks: Array<typeof bookmarksTable.$inferSelect>;
  todos: Array<typeof todosTable.$inferSelect>;
  notes: Array<typeof notesTable.$inferSelect>;
  monitorTargets: Array<typeof monitorTargetsTable.$inferSelect>;
}

const INTERNAL_KEYS = ['admin_password_hash', 'admin_session_secret', 'api_token'];

/** 导出所有表数据 */
export function exportFullBackup(): FullBackup {
  const settingRows = db.select().from(settingsTable).all();
  const catRows = db.select().from(categoriesTable).orderBy(asc(categoriesTable.order)).all();
  const bmRows = db.select().from(bookmarksTable).orderBy(asc(bookmarksTable.order)).all();
  const todoRows = db.select().from(todosTable).orderBy(asc(todosTable.createdAt)).all();
  const noteRows = db.select().from(notesTable).orderBy(desc(notesTable.updatedAt)).all();
  const monitorRows = db.select().from(monitorTargetsTable).all();

  const settings: Record<string, string> = {};
  for (const row of settingRows) {
    settings[row.key] = row.value;
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    settings,
    categories: catRows,
    bookmarks: bmRows,
    todos: todoRows,
    notes: noteRows,
    monitorTargets: monitorRows,
  };
}

/** 从全量备份恢复所有表数据（保留当前内部密钥） */
export function restoreFullBackup(backup: FullBackup): void {
  sqlite.transaction(() => {
    // 1. 先保存当前内部密钥，避免恢复后被覆盖导致管理后台无法登录
    const preservedKeys: Array<{ key: string; value: string }> = [];
    try {
      const placeholders = INTERNAL_KEYS.map(() => '?').join(',');
      preservedKeys.push(
        ...sqlite.prepare(
          `SELECT key, value FROM settings WHERE key IN (${placeholders})`
        ).all(...INTERNAL_KEYS) as Array<{ key: string; value: string }>
      );
    } catch { /* 表可能还不存在 */ }

    // 2. 清空所有表（注意外键顺序）
    db.delete(bookmarksTable).run();
    db.delete(categoriesTable).run();
    db.delete(todosTable).run();
    db.delete(notesTable).run();
    db.delete(settingsTable).run();
    db.delete(monitorTargetsTable).run();

    // 3. 恢复 settings
    for (const [key, value] of Object.entries(backup.settings)) {
      db.insert(settingsTable).values({ key, value }).run();
    }

    // 4. 恢复 categories
    for (const cat of backup.categories) {
      db.insert(categoriesTable).values(cat).run();
    }

    // 5. 恢复 bookmarks（依赖 categories 先插入）
    for (const bm of backup.bookmarks) {
      db.insert(bookmarksTable).values(bm).run();
    }

    // 6. 恢复 todos
    for (const todo of backup.todos) {
      db.insert(todosTable).values(todo).run();
    }

    // 7. 恢复 notes
    for (const note of backup.notes) {
      db.insert(notesTable).values(note).run();
    }

    // 8. 恢复 monitor targets
    for (const mt of backup.monitorTargets) {
      db.insert(monitorTargetsTable).values(mt).run();
    }

    // 9. 覆盖恢复内部密钥（确保当前管理员仍可登录）
    for (const row of preservedKeys) {
      db.insert(settingsTable).values({ key: row.key, value: row.value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: row.value } })
        .run();
    }
  })();
}
