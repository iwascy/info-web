package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestRedactTaskFileNamesForPikpak115(t *testing.T) {
	currentFile := "剧集/SomeShow.S07/E12.2160p.HDR.DV.mkv"
	task := SyncTask{
		ServiceKey:  "pikpak-115-sg2",
		TaskID:      "pikpak_115_main",
		CurrentFile: &currentFile,
		ErrorSamples: []ErrSam{{
			File:    "OST.flac.zip",
			Payload: json.RawMessage(`{"file":"OST.flac.zip","stage":"upload"}`),
		}},
		RecentFiles: []File{{Name: "E12.2160p.HDR.DV.mkv"}},
	}

	redactTaskFileNames(&task)

	if task.CurrentFile == nil || *task.CurrentFile != hiddenFileName {
		t.Fatalf("CurrentFile was not redacted: %v", task.CurrentFile)
	}
	if task.ErrorSamples[0].File != hiddenFileName {
		t.Fatalf("error sample file was not redacted: %q", task.ErrorSamples[0].File)
	}
	if task.RecentFiles[0].Name != hiddenFileName {
		t.Fatalf("recent file name was not redacted: %q", task.RecentFiles[0].Name)
	}
	if strings.Contains(string(task.ErrorSamples[0].Payload), "OST.flac.zip") {
		t.Fatalf("payload still contains raw file name: %s", task.ErrorSamples[0].Payload)
	}
}

func TestRedactEventFileNamesForPikpak115(t *testing.T) {
	taskID := "pikpak_115_main"
	fileName := "E12.2160p.HDR.DV.mkv"
	event := Event{
		ServiceKey: "pikpak-115-sg2",
		TaskID:     &taskID,
		FileName:   &fileName,
		RawPayload: json.RawMessage(`{"current_file":"E12.2160p.HDR.DV.mkv","file_name":"E12.2160p.HDR.DV.mkv","message":"ok"}`),
	}

	redactEventFileNames(&event)

	if event.FileName == nil || *event.FileName != hiddenFileName {
		t.Fatalf("event FileName was not redacted: %v", event.FileName)
	}
	if strings.Contains(string(event.RawPayload), "E12.2160p.HDR.DV.mkv") {
		t.Fatalf("event payload still contains raw file name: %s", event.RawPayload)
	}
}

func TestLoadAuthConfig(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/auth.json"
	if err := os.WriteFile(path, []byte(`{"username":" opspilot ","password":"secret"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("OPSPILOT_AUTH_CONFIG", path)

	conf, err := loadAuthConfig()
	if err != nil {
		t.Fatal(err)
	}
	if conf.Username != "opspilot" || conf.Password != "secret" {
		t.Fatalf("unexpected config: %#v", conf)
	}
}

func TestLoginUsesConfiguredCredentials(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	app := &App{
		db:       db,
		token:    "ingest-token",
		authConf: AuthConfig{Username: "opspilot", Password: "secret"},
	}
	if err := app.migrate(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"opspilot","password":"secret"}`))
	res := httptest.NewRecorder()
	app.login(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["token"] == "" || payload["token"] == "ingest-token" {
		t.Fatalf("unexpected token: %#v", payload)
	}

	bad := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"opspilot","password":"bad"}`))
	badRes := httptest.NewRecorder()
	app.login(badRes, bad)
	if badRes.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", badRes.Code)
	}
}

func TestPanelRoutesRejectIngestToken(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	app := &App{
		db:       db,
		token:    "ingest-token",
		authConf: AuthConfig{Username: "opspilot", Password: "secret"},
	}
	if err := app.migrate(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer ingest-token")
	res := httptest.NewRecorder()
	app.panelAuth(http.HandlerFunc(app.me)).ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected panel auth to reject ingest token, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/heartbeat", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer ingest-token")
	res = httptest.NewRecorder()
	app.ingestAuth(http.HandlerFunc(app.ok)).ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected ingest auth to accept ingest token, got %d", res.Code)
	}
}
