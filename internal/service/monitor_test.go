package service

import (
	"database/sql"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/model"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migration failed: %v", err)
	}
	return database
}

func TestCheckTarget(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	database := setupTestDB(t)
	hc := NewHealthChecker(database)
	target, err := hc.AddTarget(model.MonitorTargetInput{Name: "test", URL: ts.URL})
	if err != nil {
		t.Fatalf("AddTarget failed: %v", err)
	}

	// CheckNow triggers a health check and stores the result internally
	got := hc.CheckNow(target.ID)
	if got == nil {
		t.Fatal("CheckNow returned nil")
	}

	results := hc.GetResults()
	var cr model.CheckResult
	var found bool
	for _, r := range results {
		if r.ID == target.ID {
			cr = r
			found = true
			break
		}
	}
	if !found {
		t.Fatal("target result not found in GetResults")
	}
	if cr.Status != "ok" {
		t.Errorf("expected status ok, got %s", cr.Status)
	}
	if cr.Latency == nil {
		t.Error("expected latency to be set")
	}
}

func TestCheckTargetTimeout(t *testing.T) {
	// Use a raw TCP listener that accepts connections but never responds,
	// avoiding httptest.Server.Close() hanging on a blocked handler.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			// Read request bytes so client send doesn't block,
			// but never write a response — causing client-side timeout.
			go func(c net.Conn) {
				_ = c.SetReadDeadline(time.Now().Add(10 * time.Second))
				_, _ = io.Copy(io.Discard, c)
				c.Close()
			}(conn)
		}
	}()

	database := setupTestDB(t)
	hc := NewHealthChecker(database)
	target, err := hc.AddTarget(model.MonitorTargetInput{
		Name:    "timeout",
		URL:     "http://" + ln.Addr().String(),
		Timeout: 100, // 100ms client timeout
	})
	if err != nil {
		t.Fatalf("AddTarget failed: %v", err)
	}

	got := hc.CheckNow(target.ID)
	if got == nil {
		t.Fatal("CheckNow returned nil")
	}

	results := hc.GetResults()
	var cr model.CheckResult
	var found bool
	for _, r := range results {
		if r.ID == target.ID {
			cr = r
			found = true
			break
		}
	}
	if !found {
		t.Fatal("target result not found in GetResults")
	}
	if cr.Status != "timeout" {
		t.Errorf("expected status timeout, got %s", cr.Status)
	}
}
