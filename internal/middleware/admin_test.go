package middleware

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/YingXiaoMo/nav/internal/db"
	"github.com/YingXiaoMo/nav/internal/db/queries"
	"github.com/YingXiaoMo/nav/internal/session"
)

func setupAuthTest(t *testing.T) (http.Handler, string) {
	t.Helper()
	database, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(ON)")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	database.SetMaxOpenConns(1)
	t.Cleanup(func() { database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	const secret = "test-session-secret"
	if err := queries.SetSetting(t.Context(), database, "session_secret", secret); err != nil {
		t.Fatalf("set secret: %v", err)
	}

	// next handler simply reports it was reached
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("reached"))
	})
	handler := SessionAuth(database)(next)

	validCookie := session.Sign("user-1", secret)
	return handler, validCookie
}

func do(t *testing.T, handler http.Handler, method, path, cookie string) int {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: session.CookieName, Value: cookie})
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Code
}

// TestSessionAuth_SecretsRequireAuth locks the C-1 fix: the settings endpoints
// (which expose session_secret and other credentials) must never be reachable
// without a valid session, regardless of HTTP method.
func TestSessionAuth_SecretsRequireAuth(t *testing.T) {
	handler, _ := setupAuthTest(t)

	cases := []struct {
		method, path string
	}{
		{"GET", "/api/v1/settings"},
		{"GET", "/api/v1/settings/session_secret"},
		{"GET", "/api/v1/settings/device_config"},
		{"GET", "/api/v1/admin/backup"},
		{"GET", "/api/v1/parse"},
		{"GET", "/api/v1/admin/logs"},
		{"PUT", "/api/v1/settings"},
		{"POST", "/api/v1/data"},
	}
	for _, c := range cases {
		if code := do(t, handler, c.method, c.path, ""); code != http.StatusUnauthorized {
			t.Errorf("%s %s: expected 401 without session, got %d", c.method, c.path, code)
		}
	}
}

// TestSessionAuth_PublicRead confirms the homepage read endpoints stay reachable
// for anonymous visitors.
func TestSessionAuth_PublicRead(t *testing.T) {
	handler, _ := setupAuthTest(t)

	public := []string{
		"/api/v1/data",
		"/api/v1/suggest",
		"/api/v1/categories",
		"/api/v1/bookmarks",
		"/api/v1/bookmarks/abc",
		"/api/v1/todos",
		"/api/v1/notes",
		"/api/v1/admin/monitor/all",
	}
	for _, p := range public {
		if code := do(t, handler, "GET", p, ""); code != http.StatusOK {
			t.Errorf("GET %s: expected 200 (public read), got %d", p, code)
		}
	}
}

// TestSessionAuth_StaticFrontendPublic confirms the static frontend (non-/api/
// paths: homepage HTML/JS/CSS, /admin UI shell, favicons) is served to anonymous
// visitors. Regression guard — the default-deny policy must not lock the public
// start page's own assets behind auth while its data endpoints stay public.
func TestSessionAuth_StaticFrontendPublic(t *testing.T) {
	handler, _ := setupAuthTest(t)

	static := []string{
		"/",
		"/index.html",
		"/_next/static/chunk.js",
		"/admin",
		"/favicon.ico",
		"/data.json",
	}
	for _, p := range static {
		if code := do(t, handler, "GET", p, ""); code != http.StatusOK {
			t.Errorf("GET %s: expected 200 (public static asset), got %d", p, code)
		}
	}
}

// TestSessionAuth_ValidSession confirms a signed cookie unlocks protected routes,
// and mutations to public-read resources still require it.
func TestSessionAuth_ValidSession(t *testing.T) {
	handler, cookie := setupAuthTest(t)

	if code := do(t, handler, "GET", "/api/v1/settings/session_secret", cookie); code != http.StatusOK {
		t.Errorf("GET settings with valid session: expected 200, got %d", code)
	}
	if code := do(t, handler, "PUT", "/api/v1/bookmarks/abc", ""); code != http.StatusUnauthorized {
		t.Errorf("PUT bookmark without session: expected 401, got %d", code)
	}
	if code := do(t, handler, "PUT", "/api/v1/bookmarks/abc", cookie); code != http.StatusOK {
		t.Errorf("PUT bookmark with valid session: expected 200, got %d", code)
	}
}

// TestSessionAuth_TamperedCookie ensures a forged/invalid cookie is rejected.
func TestSessionAuth_TamperedCookie(t *testing.T) {
	handler, _ := setupAuthTest(t)
	if code := do(t, handler, "GET", "/api/v1/settings", "user-1:999.deadbeef"); code != http.StatusUnauthorized {
		t.Errorf("tampered cookie: expected 401, got %d", code)
	}
}
