package queries

import (
	"context"
	"database/sql"

	"github.com/YingXiaoMo/nav/internal/model"
)

func GetAllCategories(ctx context.Context, db *sql.DB) ([]model.Category, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, title, icon, "order", created_at FROM categories ORDER BY "order" ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []model.Category
	for rows.Next() {
		var c model.Category
		if err := rows.Scan(&c.ID, &c.Title, &c.Icon, &c.Order, &c.CreatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	if cats == nil {
		cats = []model.Category{}
	}
	return cats, rows.Err()
}

func GetCategory(ctx context.Context, db *sql.DB, id string) (*model.Category, error) {
	var c model.Category
	err := db.QueryRowContext(ctx, `SELECT id, title, icon, "order", created_at FROM categories WHERE id = ?`, id).
		Scan(&c.ID, &c.Title, &c.Icon, &c.Order, &c.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func CreateCategory(ctx context.Context, db *sql.DB, input model.CategoryInput) (*model.Category, error) {
	id := model.NewID()
	now := model.Now()
	order := input.Order
	if order == 0 {
		maxOrder, _ := GetMaxCategoryOrder(ctx, db)
		order = maxOrder + 1
	}

	_, err := db.ExecContext(ctx,
		`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
		id, input.Title, input.Icon, order, now)
	if err != nil {
		return nil, err
	}

	return &model.Category{
		ID:        id,
		Title:     input.Title,
		Icon:      input.Icon,
		Order:     order,
		CreatedAt: now,
	}, nil
}

func UpdateCategory(ctx context.Context, db *sql.DB, id string, input model.CategoryInput) (int64, error) {
	result, err := db.ExecContext(ctx,
		`UPDATE categories SET title = ?, icon = ? WHERE id = ?`,
		input.Title, input.Icon, id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func DeleteCategory(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM categories WHERE id = ?`, id)
	return err
}

func GetMaxCategoryOrder(ctx context.Context, db *sql.DB) (int, error) {
	var max sql.NullInt64
	err := db.QueryRowContext(ctx, `SELECT MAX("order") FROM categories`).Scan(&max)
	if err != nil {
		return 0, err
	}
	if !max.Valid {
		return -1, nil
	}
	return int(max.Int64), nil
}
