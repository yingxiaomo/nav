package queries

import (
	"context"
	"database/sql"

	"github.com/YingXiaoMo/nav/internal/model"
)

type ReorderItem struct {
	ID    string `json:"id"`
	Order int    `json:"order"`
}

const bookmarkCols = `id, category_id, parent_id, title, url, icon, description, "order", created_at, is_folder`

func scanBookmark(scanner interface {
	Scan(dest ...any) error
	}, b *model.Bookmark) error {
	var desc sql.NullString
	var parentID sql.NullString
	if err := scanner.Scan(&b.ID, &b.CategoryID, &parentID, &b.Title, &b.URL, &b.Icon, &desc, &b.Order, &b.CreatedAt, &b.IsFolder); err != nil {
		return err
	}
	b.Description = desc.String
	b.ParentID = parentID.String
	return nil
}

func GetBookmarksByCategory(ctx context.Context, db *sql.DB, categoryID string) ([]model.Bookmark, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+bookmarkCols+` FROM bookmarks WHERE category_id = ? ORDER BY "order" ASC`,
		categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bms []model.Bookmark
	for rows.Next() {
		var b model.Bookmark
		if err := scanBookmark(rows, &b); err != nil {
			return nil, err
		}
		bms = append(bms, b)
	}
	if bms == nil {
		bms = []model.Bookmark{}
	}
	return bms, rows.Err()
}

func GetAllBookmarks(ctx context.Context, db *sql.DB, categoryID string) ([]model.Bookmark, error) {
	if categoryID != "" {
		return GetBookmarksByCategory(ctx, db, categoryID)
	}

	rows, err := db.QueryContext(ctx,
		`SELECT `+bookmarkCols+` FROM bookmarks ORDER BY "order" ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bms []model.Bookmark
	for rows.Next() {
		var b model.Bookmark
		if err := scanBookmark(rows, &b); err != nil {
			return nil, err
		}
		bms = append(bms, b)
	}
	if bms == nil {
		bms = []model.Bookmark{}
	}
	return bms, rows.Err()
}

func GetBookmark(ctx context.Context, db *sql.DB, id string) (*model.Bookmark, error) {
	var b model.Bookmark
	if err := scanBookmark(db.QueryRowContext(ctx,
		`SELECT `+bookmarkCols+` FROM bookmarks WHERE id = ?`, id), &b); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &b, nil
}

func GetBookmarksByParent(ctx context.Context, db *sql.DB, parentID string) ([]model.Bookmark, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+bookmarkCols+` FROM bookmarks WHERE parent_id = ? ORDER BY "order" ASC`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bms []model.Bookmark
	for rows.Next() {
		var b model.Bookmark
		if err := scanBookmark(rows, &b); err != nil {
			return nil, err
		}
		bms = append(bms, b)
	}
	if bms == nil {
		bms = []model.Bookmark{}
	}
	return bms, rows.Err()
}

func CreateBookmark(ctx context.Context, db *sql.DB, input model.BookmarkInput) (*model.Bookmark, error) {
	id := model.NewID()
	now := model.Now()
	order := input.Order
	if order == 0 {
		maxOrder, _ := GetMaxBookmarkOrder(ctx, db, input.CategoryID)
		order = maxOrder + 1
	}

	isFolder := 0
	if input.IsFolder {
		isFolder = 1
	}

	_, err := db.ExecContext(ctx,
		`INSERT INTO bookmarks (id, category_id, parent_id, title, url, icon, description, "order", created_at, is_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.CategoryID, nullIfEmpty(input.ParentID), input.Title, input.URL, input.Icon, input.Description, order, now, isFolder)
	if err != nil {
		return nil, err
	}

	return &model.Bookmark{
		ID:          id,
		CategoryID:  input.CategoryID,
		ParentID:    input.ParentID,
		Title:       input.Title,
		URL:         input.URL,
		Icon:        input.Icon,
		Description: input.Description,
		IsFolder:    isFolder,
		Order:       order,
		CreatedAt:   now,
	}, nil
}

func UpdateBookmark(ctx context.Context, db *sql.DB, id string, input model.BookmarkInput) (int64, error) {
	result, err := db.ExecContext(ctx,
		`UPDATE bookmarks SET category_id = ?, title = ?, url = ?, icon = ?, description = ?, parent_id = ?, is_folder = ? WHERE id = ?`,
		input.CategoryID, input.Title, input.URL, input.Icon, input.Description, nullIfEmpty(input.ParentID), boolToInt(input.IsFolder), id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func DeleteBookmark(ctx context.Context, db *sql.DB, id string) error {
	// CASCADE 由外键约束自动递归删除子项
	_, err := db.ExecContext(ctx, `DELETE FROM bookmarks WHERE id = ?`, id)
	return err
}

func ReorderBookmarks(ctx context.Context, db *sql.DB, items []ReorderItem) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `UPDATE bookmarks SET "order" = ? WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		if _, err := stmt.ExecContext(ctx, item.Order, item.ID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func GetMaxBookmarkOrder(ctx context.Context, db *sql.DB, categoryID string) (int, error) {
	var max sql.NullInt64
	err := db.QueryRowContext(ctx, `SELECT MAX("order") FROM bookmarks WHERE category_id = ?`, categoryID).Scan(&max)
	if err != nil {
		return 0, err
	}
	if !max.Valid {
		return -1, nil
	}
	return int(max.Int64), nil
}

func CategoryExists(ctx context.Context, db *sql.DB, id string) (bool, error) {
	var exists int
	err := db.QueryRowContext(ctx, `SELECT 1 FROM categories WHERE id = ?`, id).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// nullIfEmpty 将空字符串转为 nil（映射为 SQL NULL），非空则返回原值
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
