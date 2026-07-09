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
		TaskID:      "file_transfer_115",
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
	taskID := "file_transfer_115"
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

func TestProgressPersistsMigrationDetails(t *testing.T) {
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

	body := `{
		"service_key":"pikpak-to-115",
		"task_id":"pikpak-to-115-migration",
		"name":"PikPak to 115 Migration",
		"status":"running",
		"stage":"upload",
		"total":10,
		"processed":4,
		"success":4,
		"failed":1,
		"progress":40,
		"recent_files":[{"name":"show.mkv","size":123,"path":"upload","status":"success","upload_speed":456,"duration":"00:02"}],
		"batches":[{"range":"batch 1/3","total":2,"success":2,"failed":0,"duration":"00:02"}],
		"error_samples":[{"file":"bad.mkv","code":"rclone_copy_failed","reason":"copy failed","level":"error","payload":{"exit_code":1}}],
		"accounts":[{"side":"source","label":"PikPak","account":"pikpak:","used_bytes":0,"total_bytes":0,"unit":"remote","ok":true}]
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(body))
	res := httptest.NewRecorder()
	app.postProgress(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected progress 200, got %d: %s", res.Code, res.Body.String())
	}

	for table, want := range map[string]int{
		"recent_files":   1,
		"batch_records":  1,
		"error_samples":  1,
		"account_health": 1,
	} {
		var got int
		if err := db.QueryRow("SELECT COUNT(*) FROM " + table + " WHERE task_id='pikpak-to-115-migration'").Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("%s count = %d, want %d", table, got, want)
		}
	}
}

func TestServerTrafficUpsertAndDashboard(t *testing.T) {
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

	body := `{
		"server_key":"oracle-singapore-2",
		"server_name":"甲骨文新加坡2号机",
		"provider":"oracle",
		"region":"sg",
		"interface":"enp0s6",
		"period":"2026-07",
		"rx_bytes":100,
		"tx_bytes":200,
		"quota_bytes":1000,
		"source":"vnstat",
		"sampled_at":"2026-07-08T10:45:00Z"
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/server-traffic", strings.NewReader(body))
	res := httptest.NewRecorder()
	app.postServerTraffic(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected traffic post 200, got %d: %s", res.Code, res.Body.String())
	}
	var created ServerTraffic
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if created.TotalBytes != 300 {
		t.Fatalf("total_bytes = %d, want 300", created.TotalBytes)
	}
	if created.UsagePct == nil || *created.UsagePct != 30 {
		t.Fatalf("usage_pct = %v, want 30", created.UsagePct)
	}

	// Upsert same key with higher usage.
	body2 := `{
		"server_key":"oracle-singapore-2",
		"server_name":"甲骨文新加坡2号机",
		"provider":"oracle",
		"region":"sg",
		"interface":"enp0s6",
		"period":"2026-07",
		"rx_bytes":400,
		"tx_bytes":600,
		"quota_bytes":1000,
		"source":"vnstat",
		"sampled_at":"2026-07-09T01:00:00Z"
	}`
	req = httptest.NewRequest(http.MethodPost, "/api/server-traffic", strings.NewReader(body2))
	res = httptest.NewRecorder()
	app.postServerTraffic(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected traffic upsert 200, got %d: %s", res.Code, res.Body.String())
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM server_traffic").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("row count = %d, want 1 after upsert", count)
	}

	// Older period should not replace latest-only dashboard view.
	oldBody := `{
		"server_key":"oracle-singapore-2",
		"server_name":"甲骨文新加坡2号机",
		"interface":"enp0s6",
		"period":"2026-06",
		"rx_bytes":1,
		"tx_bytes":1,
		"quota_bytes":1000,
		"source":"vnstat"
	}`
	req = httptest.NewRequest(http.MethodPost, "/api/server-traffic", strings.NewReader(oldBody))
	res = httptest.NewRecorder()
	app.postServerTraffic(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected old period post 200, got %d: %s", res.Code, res.Body.String())
	}

	dashReq := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	dashRes := httptest.NewRecorder()
	app.getDashboard(dashRes, dashReq)
	if dashRes.Code != http.StatusOK {
		t.Fatalf("expected dashboard 200, got %d: %s", dashRes.Code, dashRes.Body.String())
	}
	var dash map[string]any
	if err := json.NewDecoder(dashRes.Body).Decode(&dash); err != nil {
		t.Fatal(err)
	}
	if dash["server_traffic_bytes"].(float64) != 1000 {
		t.Fatalf("server_traffic_bytes = %v, want 1000", dash["server_traffic_bytes"])
	}
	if dash["server_traffic_quota"].(float64) != 1000 {
		t.Fatalf("server_traffic_quota = %v, want 1000", dash["server_traffic_quota"])
	}
	rows, ok := dash["server_traffic"].([]any)
	if !ok || len(rows) != 1 {
		t.Fatalf("server_traffic rows = %#v, want 1 latest", dash["server_traffic"])
	}
	row := rows[0].(map[string]any)
	if row["period"] != "2026-07" || row["total_bytes"].(float64) != 1000 {
		t.Fatalf("unexpected latest traffic row: %#v", row)
	}
}

func TestProgressPreservesLastThroughput(t *testing.T) {
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

	withSpeed := `{
		"service_key":"pikpak-to-115",
		"task_id":"pikpak-to-115-migration",
		"name":"PikPak to 115 Migration",
		"status":"running",
		"stage":"upload",
		"download_speed":10485760,
		"upload_speed":8388608
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(withSpeed))
	res := httptest.NewRecorder()
	app.postProgress(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected progress 200, got %d: %s", res.Code, res.Body.String())
	}

	withoutSpeed := `{
		"service_key":"pikpak-to-115",
		"task_id":"pikpak-to-115-migration",
		"name":"PikPak to 115 Migration",
		"status":"running",
		"stage":"upload",
		"message":"batch completed"
	}`
	req = httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(withoutSpeed))
	res = httptest.NewRecorder()
	app.postProgress(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected progress 200, got %d: %s", res.Code, res.Body.String())
	}

	var dl, ul int64
	if err := db.QueryRow("SELECT download_speed, upload_speed FROM sync_tasks WHERE task_id='pikpak-to-115-migration'").Scan(&dl, &ul); err != nil {
		t.Fatal(err)
	}
	if dl != 10485760 || ul != 8388608 {
		t.Fatalf("throughput = %d/%d, want 10485760/8388608", dl, ul)
	}
}
