import { db, sqlite } from '../db/index.ts';
import { categories as categoriesTable, bookmarks as bookmarksTable, todos as todosTable, notes as notesTable, settings as settingsTable } from '../db/schema.ts';
import { eq, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DataSchema, Category, LinkItem, Todo, Note, SiteSettings } from '../types/index.ts';

// ===== 组装：从 DB 行 → DataSchema =====

function toLinkItem(row: typeof bookmarksTable.$inferSelect): LinkItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    icon: row.icon ?? undefined,
    description: row.description ?? undefined,
    updatedAt: row.createdAt,
    order: row.order,
  };
}

function toCategory(
  catRow: typeof categoriesTable.$inferSelect,
  linkRows: Array<typeof bookmarksTable.$inferSelect>,
): Category {
  return {
    id: catRow.id,
    title: catRow.title,
    icon: catRow.icon ?? undefined,
    order: catRow.order,
    updatedAt: catRow.createdAt,
    links: linkRows.map(toLinkItem),
  };
}

function toTodo(row: typeof todosTable.$inferSelect): Todo {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    createdAt: row.createdAt,
  };
}

function toNote(row: typeof notesTable.$inferSelect): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updatedAt,
  };
}

/** 从 K/V 行解析 SiteSettings，缺失字段用默认值 */
function toSiteSettings(rows: Array<typeof settingsTable.$inferSelect>): SiteSettings {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      map.set(row.key, row.value);
    }
  }

  return {
    title: (map.get('title') as string) ?? 'Clean Nav',
    wallpaper: (map.get('wallpaper') as string) ?? '',
    wallpaperType: (map.get('wallpaperType') as SiteSettings['wallpaperType']) ?? 'local',
    wallpaperList: (map.get('wallpaperList') as string[]) ?? [],
    blurLevel: (map.get('blurLevel') as SiteSettings['blurLevel']) ?? 'medium',
    maxPackedWallpapers: map.get('maxPackedWallpapers') as number | undefined,
    showFeatures: map.get('showFeatures') as boolean | undefined,
    homeLayout: map.get('homeLayout') as SiteSettings['homeLayout'] | undefined,
    theme: map.get('theme') as SiteSettings['theme'] | undefined,
  };
}

/** 从 K/V 行中提取 pinnedLinks */
function toPinnedLinks(rows: Array<typeof settingsTable.$inferSelect>): LinkItem[] {
  const row = rows.find(r => r.key === 'pinnedLinks');
  if (!row) return [];
  try {
    return JSON.parse(row.value) as LinkItem[];
  } catch {
    return [];
  }
}

// ===== Service: 获取完整数据快照 =====

export async function getFullData(): Promise<DataSchema> {
  // 并行查询所有表
  const [catRows, bmRows, todoRows, noteRows, settingRows] = await Promise.all([
    db.select().from(categoriesTable).orderBy(asc(categoriesTable.order)),
    db.select().from(bookmarksTable).orderBy(asc(bookmarksTable.order)),
    db.select().from(todosTable).orderBy(asc(todosTable.createdAt)),
    db.select().from(notesTable).orderBy(desc(notesTable.updatedAt)),
    db.select().from(settingsTable),
  ]);

  // 按分类分组书签
  const bmByCategory = new Map<string, Array<typeof bookmarksTable.$inferSelect>>();
  for (const bm of bmRows) {
    const list = bmByCategory.get(bm.categoryId) ?? [];
    list.push(bm);
    bmByCategory.set(bm.categoryId, list);
  }

  return {
    settings: toSiteSettings(settingRows),
    categories: catRows.map(cat => toCategory(cat, bmByCategory.get(cat.id) ?? [])),
    todos: todoRows.map(toTodo),
    notes: noteRows.map(toNote),
    pinnedLinks: toPinnedLinks(settingRows),
  };
}

// ===== Service: 全量替换数据（事务）=====

export function replaceFullData(data: DataSchema): void {
  sqlite.transaction(() => {
    // 1. 清空旧数据（注意外键顺序）
    db.delete(bookmarksTable).run();
    db.delete(categoriesTable).run();
    db.delete(todosTable).run();
    db.delete(notesTable).run();
    db.delete(settingsTable).run();

    const now = Date.now();

    // 2. 插入分类 + 书签
    for (let ci = 0; ci < data.categories.length; ci++) {
      const cat = data.categories[ci];
      const catId = cat.id || nanoid();

      db.insert(categoriesTable).values({
        id: catId,
        title: cat.title,
        icon: cat.icon ?? null,
        order: cat.order ?? ci,
        createdAt: cat.updatedAt ?? now,
      }).run();

      for (let li = 0; li < cat.links.length; li++) {
        const link = cat.links[li];
        db.insert(bookmarksTable).values({
          id: link.id || nanoid(),
          categoryId: catId,
          title: link.title,
          url: link.url,
          icon: link.icon ?? null,
          description: link.description ?? null,
          order: link.order ?? li,
          createdAt: link.updatedAt ?? now,
        }).run();
      }
    }

    // 3. 插入待办
    for (const todo of data.todos ?? []) {
      db.insert(todosTable).values({
        id: todo.id || nanoid(),
        text: todo.text,
        completed: todo.completed,
        createdAt: todo.createdAt ?? now,
      }).run();
    }

    // 4. 插入笔记
    for (const note of data.notes ?? []) {
      db.insert(notesTable).values({
        id: note.id || nanoid(),
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt ?? now,
      }).run();
    }

    // 5. 写入配置（SiteSettings 各字段 + pinnedLinks）
    const settingsMap: Record<string, unknown> = {
      ...data.settings,
      pinnedLinks: data.pinnedLinks,
    };

    for (const [key, value] of Object.entries(settingsMap)) {
      if (value === undefined) continue;
      db.insert(settingsTable).values({
        key,
        value: JSON.stringify(value),
      }).run();
    }
  })();
}
