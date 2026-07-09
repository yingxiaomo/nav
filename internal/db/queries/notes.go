package queries

import (
	"context"
	"database/sql"

	"github.com/YingXiaoMo/nav/internal/model"
)

func GetAllNotes(ctx context.Context, db *sql.DB) ([]model.Note, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, title, content, updated_at FROM notes ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []model.Note
	for rows.Next() {
		var n model.Note
		if err := rows.Scan(&n.ID, &n.Title, &n.Content, &n.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []model.Note{}
	}
	return notes, rows.Err()
}

func GetNote(ctx context.Context, db *sql.DB, id string) (*model.Note, error) {
	var n model.Note
	err := db.QueryRowContext(ctx,
		`SELECT id, title, content, updated_at FROM notes WHERE id = ?`, id).
		Scan(&n.ID, &n.Title, &n.Content, &n.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func CreateNote(ctx context.Context, db *sql.DB, title, content string) (*model.Note, error) {
	id := model.NewID()
	now := model.Now()
	_, err := db.ExecContext(ctx,
		`INSERT INTO notes (id, title, content, updated_at) VALUES (?, ?, ?, ?)`,
		id, title, content, now)
	if err != nil {
		return nil, err
	}
	return &model.Note{
		ID:        id,
		Title:     title,
		Content:   content,
		UpdatedAt: now,
	}, nil
}

func UpdateNote(ctx context.Context, db *sql.DB, id, title, content string) (int64, error) {
	result, err := db.ExecContext(ctx,
		`UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?`,
		title, content, model.Now(), id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func DeleteNote(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, id)
	return err
}
