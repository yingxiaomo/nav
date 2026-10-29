package queries

import (
	"context"
	"database/sql"
	"testing"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/model"
)

// queries 层此前 0% 覆盖：纯 SQL 函数是最划算的补测起点。
// 用 :memory: SQLite + 真实迁移建表，验证 SQL 语义本身
// （自动排序、级联删除、排序事务、空串转 NULL）。

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return database
}

func seedCategory(t *testing.T, d *sql.DB, id, title string) {
	t.Helper()
	if _, err := d.Exec(`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, 'Folder', 0, 1)`, id, title); err != nil {
		t.Fatalf("seed category: %v", err)
	}
}

func titlesOf(bms []model.Bookmark) []string {
	out := make([]string, len(bms))
	for i, b := range bms {
		out[i] = b.Title
	}
	return out
}

func TestCreateBookmarkAutoOrder(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	seedCategory(t, d, "cat1", "C")

	b1, err := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "a", URL: "https://a.com"})
	if err != nil {
		t.Fatalf("create1: %v", err)
	}
	b2, err := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "b", URL: "https://b.com"})
	if err != nil {
		t.Fatalf("create2: %v", err)
	}
	if b1.Order != 0 || b2.Order != 1 {
		t.Errorf("自动排序应为 0,1（空分类 max=-1 起步）got %d,%d", b1.Order, b2.Order)
	}

	// order 显式指定时不自动取 max+1
	b3, _ := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "c", URL: "https://c.com", Order: 100})
	if b3.Order != 100 {
		t.Errorf("显式 order 应保留 got %d", b3.Order)
	}
}

func TestCreateBookmarkFolderNullParent(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	seedCategory(t, d, "cat1", "C")

	// 子链接挂在文件夹下：parent_id 非空
	folder, _ := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "f", IsFolder: true})
	child, _ := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "c", URL: "https://c.com", ParentID: folder.ID})

	// 文件夹自身 parent_id 应为 NULL（空串经 nullIfEmpty 转 NULL）
	var parent sql.NullString
	if err := d.QueryRow(`SELECT parent_id FROM bookmarks WHERE id = ?`, folder.ID).Scan(&parent); err != nil {
		t.Fatalf("scan: %v", err)
	}
	if parent.Valid {
		t.Errorf("顶层条目 parent_id 应为 NULL, got %q", parent.String)
	}
	_ = child

	// 级联删除：删文件夹应连带删除子链接（外键 CASCADE，连接已开 foreign_keys）
	if err := DeleteBookmark(ctx, d, folder.ID); err != nil {
		t.Fatalf("delete folder: %v", err)
	}
	if b, _ := GetBookmark(ctx, d, child.ID); b != nil {
		t.Error("删除文件夹后子链接应被 CASCADE 删除")
	}
}

func TestReorderBookmarks(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	seedCategory(t, d, "cat1", "C")

	var ids []string
	for _, title := range []string{"a", "b", "c"} {
		b, _ := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: title, URL: "https://x.com"})
		ids = append(ids, b.ID)
	}

	if err := ReorderBookmarks(ctx, d, []ReorderItem{{ID: ids[2], Order: 0}, {ID: ids[0], Order: 1}, {ID: ids[1], Order: 2}}); err != nil {
		t.Fatalf("reorder: %v", err)
	}

	bms, err := GetBookmarksByCategory(ctx, d, "cat1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(bms) != 3 || bms[0].Title != "c" || bms[1].Title != "a" || bms[2].Title != "b" {
		t.Errorf("排序结果不符: %v", titlesOf(bms))
	}
}

func TestCategoryExists(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	seedCategory(t, d, "cat1", "C")

	if ok, _ := CategoryExists(ctx, d, "cat1"); !ok {
		t.Error("存在的分类应返回 true")
	}
	if ok, _ := CategoryExists(ctx, d, "nope"); ok {
		t.Error("不存在的分类应返回 false")
	}
}

func TestUpdateBookmark(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	seedCategory(t, d, "cat1", "C")
	b, _ := CreateBookmark(ctx, d, model.BookmarkInput{CategoryID: "cat1", Title: "old", URL: "https://old.com"})

	n, err := UpdateBookmark(ctx, d, b.ID, model.BookmarkInput{CategoryID: "cat1", Title: "new", URL: "https://new.com"})
	if err != nil || n != 1 {
		t.Fatalf("update: n=%d err=%v", n, err)
	}
	got, _ := GetBookmark(ctx, d, b.ID)
	if got.Title != "new" || got.URL != "https://new.com" {
		t.Errorf("更新未生效: %+v", got)
	}
}
