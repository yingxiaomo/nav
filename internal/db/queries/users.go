package queries

import (
	"context"
	"database/sql"
)

type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    int64  `json:"createdAt"`
}

func CreateUser(ctx context.Context, db *sql.DB, id, username, passwordHash string, createdAt int64) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		id, username, passwordHash, createdAt)
	return err
}

func GetUserByUsername(ctx context.Context, db *sql.DB, username string) (*User, error) {
	u := &User{}
	err := db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, created_at FROM users WHERE username = ?`, username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func GetUserCount(ctx context.Context, db *sql.DB) (int, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

func UpdateUserPassword(ctx context.Context, db *sql.DB, userID, newPasswordHash string) error {
	_, err := db.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, newPasswordHash, userID)
	return err
}
