package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/YingXiaoMo/nav/internal/model"
)

// TestUpdateBookmark_PreservesFolderAndParent locks the H-4 fix: editing a
// bookmark/folder via PUT /api/v1/bookmarks/{id} must not clobber is_folder or
// parent_id (previously they were reset to 0 / NULL, corrupting the hierarchy).
func TestUpdateBookmark_PreservesFolderAndParent(t *testing.T) {
	h := setupHandler(t)
	now := model.Now()

	if _, err := h.DB.Exec(
		`INSERT INTO categories (id, title, icon, "order", created_at) VALUES (?, ?, ?, ?, ?)`,
		"cat-1", "Cat", "", 0, now,
	); err != nil {
		t.Fatalf("insert category: %v", err)
	}
	// A folder at the category root
	if _, err := h.DB.Exec(
		`INSERT INTO bookmarks (id, category_id, parent_id, title, url, icon, description, "order", created_at, is_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"folder-1", "cat-1", nil, "Tools", "", "", "", 0, now, 1,
	); err != nil {
		t.Fatalf("insert folder: %v", err)
	}
	// A bookmark nested inside the folder
	if _, err := h.DB.Exec(
		`INSERT INTO bookmarks (id, category_id, parent_id, title, url, icon, description, "order", created_at, is_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"bm-1", "cat-1", "folder-1", "GitHub", "https://github.com", "", "", 0, now, 0,
	); err != nil {
		t.Fatalf("insert nested bookmark: %v", err)
	}

	update := func(id string, body model.BookmarkInput) {
		t.Helper()
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest("PUT", "/api/v1/bookmarks/"+id, bytes.NewReader(raw))
		req.SetPathValue("id", id)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.UpdateBookmark()(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("update %s: expected 200, got %d: %s", id, rec.Code, rec.Body.String())
		}
	}

	// Rename the folder — it must remain a folder.
	update("folder-1", model.BookmarkInput{Title: "Renamed Tools"})
	var isFolder int
	if err := h.DB.QueryRow(`SELECT is_folder FROM bookmarks WHERE id='folder-1'`).Scan(&isFolder); err != nil {
		t.Fatalf("query folder: %v", err)
	}
	if isFolder != 1 {
		t.Errorf("folder demoted to normal bookmark after edit: is_folder=%d", isFolder)
	}

	// Edit the nested bookmark — it must stay inside the folder.
	update("bm-1", model.BookmarkInput{Title: "GitHub", URL: "https://github.com/new"})
	var parentID string
	if err := h.DB.QueryRow(`SELECT COALESCE(parent_id,'') FROM bookmarks WHERE id='bm-1'`).Scan(&parentID); err != nil {
		t.Fatalf("query nested bookmark: %v", err)
	}
	if parentID != "folder-1" {
		t.Errorf("nested bookmark moved out of folder after edit: parent_id=%q", parentID)
	}
}
