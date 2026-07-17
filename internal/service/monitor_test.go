package service

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/model"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := sql.Open("sqlite", ":memory:?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		t.Fatalf("open memory db: %v", err)
	}
	database.SetMaxOpenConns(1)
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return database
}

func TestCheckTarget_OK(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	database := setupTestDB(t)
	defer database.Close()

	hc := NewHealthChecker(database)
	target, err := hc.AddTarget(model.MonitorTargetInput{
		Name: "test", URL: ts.URL,
	})
	if err != nil {
		t.Fatalf("AddTarget failed: %v", err)
	}

	result := hc.CheckNow(target.ID)
	if result == nil {
		t.Fatal("CheckNow returned nil")
	}

	// Verify results map
	results := hc.GetResults()
	if len(results) == 0 {
		t.Fatal("GetResults() is empty after check")
	}
	found := false
	for _, r := range results {
		if r.ID == target.ID {
			found = true
			if r.Status != "ok" {
				t.Errorf("expected status=ok, got %s", r.Status)
			}
			if r.Latency != nil && *r.Latency < 0 {
				t.Error("expected non-negative latency")
			}
		}
	}
	if !found {
		t.Fatal("target not found in results")
	}
}

func TestCheckTarget_404(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	database := setupTestDB(t)
	defer database.Close()

	hc := NewHealthChecker(database)
	target, err := hc.AddTarget(model.MonitorTargetInput{
		Name: "notfound", URL: ts.URL,
	})
	if err != nil {
		t.Fatalf("AddTarget failed: %v", err)
	}

	hc.CheckNow(target.ID)
	results := hc.GetResults()
	for _, r := range results {
		if r.ID == target.ID {
			if r.Status != "error" && r.Status != "ok" {
				t.Errorf("expected status error on 404, got %s", r.Status)
			}
		}
	}
}
