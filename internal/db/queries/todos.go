package queries

import (
	"context"
	"database/sql"

	"github.com/YingXiaoMo/nav/internal/model"
)

func GetAllTodos(ctx context.Context, db *sql.DB) ([]model.Todo, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, text, completed, created_at FROM todos ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos []model.Todo
	for rows.Next() {
		var t model.Todo
		if err := rows.Scan(&t.ID, &t.Text, &t.Completed, &t.CreatedAt); err != nil {
			return nil, err
		}
		todos = append(todos, t)
	}
	if todos == nil {
		todos = []model.Todo{}
	}
	return todos, rows.Err()
}

func GetTodo(ctx context.Context, db *sql.DB, id string) (*model.Todo, error) {
	var t model.Todo
	err := db.QueryRowContext(ctx,
		`SELECT id, text, completed, created_at FROM todos WHERE id = ?`, id).
		Scan(&t.ID, &t.Text, &t.Completed, &t.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func CreateTodo(ctx context.Context, db *sql.DB, text string) (*model.Todo, error) {
	id := model.NewID()
	now := model.Now()
	_, err := db.ExecContext(ctx,
		`INSERT INTO todos (id, text, completed, created_at) VALUES (?, ?, 0, ?)`,
		id, text, now)
	if err != nil {
		return nil, err
	}
	return &model.Todo{
		ID:        id,
		Text:      text,
		Completed: false,
		CreatedAt: now,
	}, nil
}

func UpdateTodo(ctx context.Context, db *sql.DB, id, text string, completed bool) (int64, error) {
	result, err := db.ExecContext(ctx,
		`UPDATE todos SET text = ?, completed = ? WHERE id = ?`,
		text, completed, id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func DeleteTodo(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM todos WHERE id = ?`, id)
	return err
}
