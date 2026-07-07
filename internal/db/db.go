package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

func Open(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %w", err)
	}
	connStr := dbPath + "?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)"
	database, err := sql.Open("sqlite", connStr)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	database.SetConnMaxLifetime(5 * time.Minute)
	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("数据库连接失败: %w", err)
	}
	return database, nil
}

func Migrate(database *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS categories (
			id TEXT PRIMARY KEY, title TEXT NOT NULL, icon TEXT,
			"order" INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order")`,
		`CREATE TABLE IF NOT EXISTS bookmarks (
			id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			title TEXT NOT NULL, url TEXT NOT NULL, icon TEXT, description TEXT,
			"order" INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookmarks_cat_order ON bookmarks(category_id, "order")`,
		`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, text TEXT NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
			content TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS monitor_targets (id TEXT PRIMARY KEY, name TEXT NOT NULL,
			url TEXT NOT NULL, icon TEXT, mac TEXT, timeout INTEGER NOT NULL DEFAULT 5000,
			created_at INTEGER NOT NULL)`,
	}
	for _, stmt := range stmts {
		if _, err := database.Exec(stmt); err != nil {
			return fmt.Errorf("迁移失败: %w\nSQL: %s", err, stmt)
		}
	}
	return nil
}
