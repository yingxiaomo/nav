import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ===== 分类表 =====
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  icon: text('icon'),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  orderIdx: index('idx_categories_order').on(table.order),
}));

// ===== 书签表 =====
export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  icon: text('icon'),
  description: text('description'),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  categoryIdx: index('idx_bookmarks_category').on(table.categoryId),
  categoryOrderIdx: index('idx_bookmarks_cat_order').on(table.categoryId, table.order),
}));

// ===== 配置表（键值对，值统一存 JSON 字符串）=====
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),        // JSON 字符串
});

// ===== 待办表 =====
export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

// ===== 笔记表 =====
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  updatedAt: integer('updated_at').notNull(),
});

// ===== 监控目标表 =====
export const monitorTargets = sqliteTable('monitor_targets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  icon: text('icon'),
  mac: text('mac'),
  timeout: integer('timeout').notNull().default(5000),
  createdAt: integer('created_at').notNull(),
});
