package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/model"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory DB: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("failed to migrate DB: %v", err)
	}
	return database
}

func setupHandler(t *testing.T) *Handler {
	t.Helper()
	return &Handler{DB: setupTestDB(t)}
}

func TestGetData_EmptyDatabase(t *testing.T) {
	h := setupHandler(t)

	req := httptest.NewRequest("GET", "/api/v1/data", nil)
	rec := httptest.NewRecorder()

	h.GetData()(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp dataExport
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Settings.Title != "Clean Nav" {
		t.Errorf("expected default title 'Clean Nav', got %q", resp.Settings.Title)
	}
	if len(resp.Categories) != 0 {
		t.Errorf("expected 0 categories, got %d", len(resp.Categories))
	}
}

func TestGetData_WithCategories(t *testing.T) {
	h := setupHandler(t)
	now := model.Now()

	_, err := h.DB.Exec(
		`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
		"cat-1", "测试分类", "Folder", 0, now,
	)
	if err != nil {
		t.Fatalf("failed to insert category: %v", err)
	}
	_, err = h.DB.Exec(
		`INSERT INTO bookmarks (id, category_id, title, url, icon, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		"bm-1", "cat-1", "Example", "https://example.com", "", 0, now,
	)
	if err != nil {
		t.Fatalf("failed to insert bookmark: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/data", nil)
	rec := httptest.NewRecorder()
	h.GetData()(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp dataExport
	json.NewDecoder(rec.Body).Decode(&resp)
	if len(resp.Categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(resp.Categories))
	}
	if resp.Categories[0].Title != "测试分类" {
		t.Errorf("expected '测试分类', got %q", resp.Categories[0].Title)
	}
	if len(resp.Categories[0].Links) != 1 {
		t.Fatalf("expected 1 link, got %d", len(resp.Categories[0].Links))
	}
	if resp.Categories[0].Links[0].URL != "https://example.com" {
		t.Errorf("expected 'https://example.com', got %q", resp.Categories[0].Links[0].URL)
	}
}

func TestPutData_FullRoundTrip(t *testing.T) {
	h := setupHandler(t)

	input := dataImport{
		Settings: json.RawMessage(`{"title":"My Nav","wallpaper":"bg.jpg"}`),
		Categories: []categoryImport{
			{
				ID:    "cat-a",
				Title: "Dev Tools",
				Icon:  "Code",
				Order: 0,
				Links: []model.LinkItem{
					{ID: "bm-a", Title: "GitHub", URL: "https://github.com", Order: 0},
				},
			},
		},
	}

	body, _ := json.Marshal(input)
	req := httptest.NewRequest("PUT", "/api/v1/data", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.PutData()(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	getReq := httptest.NewRequest("GET", "/api/v1/data", nil)
	getRec := httptest.NewRecorder()
	h.GetData()(getRec, getReq)

	var result dataExport
	json.NewDecoder(getRec.Body).Decode(&result)

	if result.Settings.Title != "My Nav" {
		t.Errorf("expected 'My Nav', got %q", result.Settings.Title)
	}
	if len(result.Categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(result.Categories))
	}
	if result.Categories[0].Title != "Dev Tools" {
		t.Errorf("expected 'Dev Tools', got %q", result.Categories[0].Title)
	}
	if len(result.Categories[0].Links) != 1 {
		t.Fatalf("expected 1 link, got %d", len(result.Categories[0].Links))
	}
}

func TestPutData_PreservesAuthSettings(t *testing.T) {
	h := setupHandler(t)

	_, err := h.DB.Exec(`INSERT INTO settings (key, value) VALUES (?, ?)`, "api_token", "sk-secret")
	if err != nil {
		t.Fatalf("failed to set api_token: %v", err)
	}

	input := dataImport{
		Settings: json.RawMessage(`{"api_token":"should-not-override","title":"New Title"}`),
	}
	body, _ := json.Marshal(input)
	req := httptest.NewRequest("PUT", "/api/v1/data", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.PutData()(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var token string
	h.DB.QueryRow("SELECT value FROM settings WHERE key='api_token'").Scan(&token)
	if token != "sk-secret" {
		t.Errorf("expected preserved api_token 'sk-secret', got %q", token)
	}
}

func TestPutData_InvalidJSON(t *testing.T) {
	h := setupHandler(t)

	req := httptest.NewRequest("PUT", "/api/v1/data", bytes.NewReader([]byte("{invalid")))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.PutData()(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}
