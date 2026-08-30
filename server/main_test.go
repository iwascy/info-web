package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
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

func TestDCSpeedOverviewReplacesServiceSnapshot(t *testing.T) {
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

	first := `{
		"service_key":"telegram-saver",
		"generated_at":"2026-07-24T12:00:00Z",
		"retention_days":30,
		"max_samples_per_dc":200,
		"min_bytes":5242880,
		"min_duration_ms":2000,
		"dcs":[
			{"dc_id":2,"sample_count":3,"excluded_count":1,"failure_count":0,"total_bytes":300,"total_duration_ms":30,"average_speed":10,"median_speed":9,"peak_speed":12,"last_speed":11,"last_updated_at":"2026-07-24T11:59:00Z"},
			{"dc_id":5,"sample_count":4,"excluded_count":0,"failure_count":1,"total_bytes":800,"total_duration_ms":40,"average_speed":20,"median_speed":19,"peak_speed":24,"last_speed":21,"last_updated_at":"2026-07-24T11:59:30Z"}
		]
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/dc-download-stats", strings.NewReader(first))
	res := httptest.NewRecorder()
	app.postDCSpeedOverview(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected first DC report 200, got %d: %s", res.Code, res.Body.String())
	}

	second := `{
		"service_key":"telegram-saver",
		"generated_at":"2026-07-24T12:05:00Z",
		"retention_days":30,
		"max_samples_per_dc":200,
		"min_bytes":5242880,
		"min_duration_ms":2000,
		"dcs":[
			{"dc_id":5,"sample_count":5,"excluded_count":0,"failure_count":1,"total_bytes":1000,"total_duration_ms":50,"average_speed":20,"median_speed":20,"peak_speed":24,"last_speed":22,"last_updated_at":"2026-07-24T12:04:30Z"}
		]
	}`
	req = httptest.NewRequest(http.MethodPost, "/api/dc-download-stats", strings.NewReader(second))
	res = httptest.NewRecorder()
	app.postDCSpeedOverview(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected replacement DC report 200, got %d: %s", res.Code, res.Body.String())
	}

	overview, err := app.dcSpeedOverviewByService("telegram-saver")
	if err != nil {
		t.Fatal(err)
	}
	if overview == nil {
		t.Fatal("expected persisted DC overview")
	}
	if overview.GeneratedAt != "2026-07-24T12:05:00Z" {
		t.Fatalf("generated_at = %q", overview.GeneratedAt)
	}
	if len(overview.DCs) != 1 || overview.DCs[0].DCID != 5 {
		t.Fatalf("unexpected replaced DC rows: %+v", overview.DCs)
	}
	if overview.DCs[0].SampleCount != 5 || overview.DCs[0].LastSpeed != 22 {
		t.Fatalf("unexpected DC5 aggregate: %+v", overview.DCs[0])
	}
}

func TestSyncTasksPageFiltersAndPaginates(t *testing.T) {
	app := newTestApp(t)
	now := time.Now()
	for i, task := range []struct {
		status    string
		updatedAt time.Time
	}{
		{"running", now},
		{"error", now},
		{"success", now},
		{"success", now.Add(-24 * time.Hour)},
		{"success", now.Add(-48 * time.Hour)},
		{"success", now.Add(-6 * 24 * time.Hour)},
		{"success", now.Add(-8 * 24 * time.Hour)},
	} {
		_, err := app.db.Exec(`INSERT INTO sync_tasks(service_key,task_id,name,status,updated_at) VALUES(?,?,?,?,?)`,
			"svc-page", "task-page-"+strconv.Itoa(i), "Task "+strconv.Itoa(i), task.status, task.updatedAt.Format(time.RFC3339))
		if err != nil {
			t.Fatal(err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/sync-tasks/page?page_size=2", nil)
	res := httptest.NewRecorder()
	app.getSyncTasksPage(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	var payload struct {
		Items    []SyncTask     `json:"items"`
		Total    int            `json:"total"`
		Page     int            `json:"page"`
		PageSize int            `json:"page_size"`
		Counts   map[string]int `json:"counts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 2 || payload.Total != 6 || payload.Page != 1 || payload.PageSize != 2 {
		t.Fatalf("unexpected current page: %+v", payload)
	}
	if payload.Counts["all"] != 7 || payload.Counts["current"] != 6 || payload.Counts["success"] != 5 {
		t.Fatalf("unexpected task counts: %#v", payload.Counts)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/sync-tasks/page?filter=success&q=task+4&page_size=999", nil)
	res = httptest.NewRecorder()
	app.getSyncTasksPage(res, req)
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 || payload.Items[0].TaskID != "task-page-4" {
		t.Fatalf("unexpected searched page: %+v", payload)
	}
	if payload.PageSize != maximumPageSize {
		t.Fatalf("page_size = %d, want %d", payload.PageSize, maximumPageSize)
	}
}

func TestRunningTaskBecomesStaleAndProgressRecovers(t *testing.T) {
	app := newTestApp(t)
	old := time.Now().Add(-staleTaskAfter - time.Minute).Format(time.RFC3339)
	_, err := app.db.Exec(`INSERT INTO sync_tasks(service_key,task_id,name,status,updated_at,total,failed) VALUES(?,?,?,?,?,?,?)`,
		"svc-stale", "task-stale", "Stale task", "running", old, 100, 0)
	if err != nil {
		t.Fatal(err)
	}

	app.checkAlerts()
	app.checkAlerts()
	var status string
	if err := app.db.QueryRow("SELECT status FROM sync_tasks WHERE task_id='task-stale'").Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "stale" {
		t.Fatalf("status = %q, want stale", status)
	}
	var alertCount int
	if err := app.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE task_id='task-stale' AND title=? AND status='firing'", staleTaskAlertTitle).Scan(&alertCount); err != nil {
		t.Fatal(err)
	}
	if alertCount != 1 {
		t.Fatalf("stale firing alerts = %d, want 1", alertCount)
	}
	router := chi.NewRouter()
	router.Post("/api/sync-tasks/{id}/resume", app.resumeTask)
	resumeReq := httptest.NewRequest(http.MethodPost, "/api/sync-tasks/task-stale/resume", nil)
	resumeRes := httptest.NewRecorder()
	router.ServeHTTP(resumeRes, resumeReq)
	if resumeRes.Code != http.StatusConflict {
		t.Fatalf("stale resume status = %d, want 409", resumeRes.Code)
	}
	if err := app.db.QueryRow("SELECT status FROM sync_tasks WHERE task_id='task-stale'").Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "stale" {
		t.Fatalf("status after rejected resume = %q, want stale", status)
	}

	body := `{"service_key":"svc-stale","task_id":"task-stale","name":"Stale task","status":"running","progress":50}`
	req := httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(body))
	res := httptest.NewRecorder()
	app.postProgress(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("progress expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if err := app.db.QueryRow("SELECT status FROM sync_tasks WHERE task_id='task-stale'").Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "running" {
		t.Fatalf("recovered status = %q, want running", status)
	}
	if err := app.db.QueryRow("SELECT COUNT(*) FROM alerts WHERE task_id='task-stale' AND title=? AND status='firing'", staleTaskAlertTitle).Scan(&alertCount); err != nil {
		t.Fatal(err)
	}
	if alertCount != 0 {
		t.Fatalf("stale firing alerts after progress = %d, want 0", alertCount)
	}
}

func TestAlertsPageAndCount(t *testing.T) {
	app := newTestApp(t)
	now := time.Now().Format(time.RFC3339)
	for _, alert := range []struct {
		status, severity string
	}{
		{"firing", "high"},
		{"firing", "medium"},
		{"firing", "low"},
		{"resolved", "high"},
		{"muted", "low"},
	} {
		_, err := app.db.Exec(`INSERT INTO alerts(service_key,severity,title,message,status,triggered_at) VALUES(?,?,?,?,?,?)`,
			"svc-alert", alert.severity, alert.status+alert.severity, "message", alert.status, now)
		if err != nil {
			t.Fatal(err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/alerts/page?filter=status&status=firing&page_size=2", nil)
	res := httptest.NewRecorder()
	app.getAlertsPage(res, req)
	var page struct {
		Items    []Alert        `json:"items"`
		Total    int            `json:"total"`
		PageSize int            `json:"page_size"`
		Counts   map[string]int `json:"counts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		t.Fatal(err)
	}
	if res.Code != http.StatusOK || len(page.Items) != 2 || page.Total != 3 || page.Counts["all"] != 5 || page.Counts["high"] != 2 {
		t.Fatalf("unexpected alerts page: code=%d payload=%+v", res.Code, page)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/alerts/count", nil)
	res = httptest.NewRecorder()
	app.getAlertsCount(res, req)
	var count struct {
		Count  int            `json:"count"`
		Counts map[string]int `json:"counts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&count); err != nil {
		t.Fatal(err)
	}
	if count.Count != 3 || count.Counts["resolved"] != 1 || count.Counts["muted"] != 1 {
		t.Fatalf("unexpected alert count response: %+v", count)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/alerts/count?status=resolved", nil)
	res = httptest.NewRecorder()
	app.getAlertsCount(res, req)
	if err := json.NewDecoder(res.Body).Decode(&count); err != nil {
		t.Fatal(err)
	}
	if res.Code != http.StatusOK || count.Count != 1 {
		t.Fatalf("resolved alert count: code=%d payload=%+v", res.Code, count)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/alerts/count?status=invalid", nil)
	res = httptest.NewRecorder()
	app.getAlertsCount(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("invalid alert count status code = %d, want 400", res.Code)
	}
}

func TestDashboardLimitsRowsAndUsesTodayCounts(t *testing.T) {
	app := newTestApp(t)
	now := time.Now()
	old := now.Add(-48 * time.Hour)
	for i := 0; i < 8; i++ {
		updatedAt := now
		if i >= 6 {
			updatedAt = old
		}
		_, err := app.db.Exec(`INSERT INTO sync_tasks(service_key,task_id,name,status,updated_at) VALUES(?,?,?,?,?)`,
			"svc-dashboard", "dashboard-task-"+strconv.Itoa(i), "Dashboard task", "success", updatedAt.Format(time.RFC3339))
		if err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 9; i++ {
		triggeredAt := now
		if i >= 7 {
			triggeredAt = old
		}
		_, err := app.db.Exec(`INSERT INTO alerts(service_key,severity,title,message,status,triggered_at) VALUES(?,?,?,?,?,?)`,
			"svc-dashboard", "medium", "Dashboard alert "+strconv.Itoa(i), "message", "firing", triggeredAt.Format(time.RFC3339))
		if err != nil {
			t.Fatal(err)
		}
	}

	res := httptest.NewRecorder()
	app.getDashboard(res, httptest.NewRequest(http.MethodGet, "/api/dashboard", nil))
	var payload struct {
		TodayAlerts        int        `json:"today_alerts"`
		FiringAlerts       int        `json:"firing_alerts"`
		TodayCompletedTask int        `json:"today_completed_tasks"`
		Tasks              []SyncTask `json:"sync_tasks"`
		Alerts             []Alert    `json:"alerts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.TodayAlerts != 7 || payload.FiringAlerts != 9 || payload.TodayCompletedTask != 6 {
		t.Fatalf("unexpected dashboard counts: %+v", payload)
	}
	if len(payload.Tasks) != 5 || len(payload.Alerts) != 5 {
		t.Fatalf("dashboard row limits = %d tasks/%d alerts, want 5/5", len(payload.Tasks), len(payload.Alerts))
	}
}

func TestPikpakFullCheckCommandAndBaseURL(t *testing.T) {
	t.Setenv("PIKPAK115_OPSPILOT_BASE_URL", "https://panel.example/api/")
	if got := localOpsPilotBaseURL(); got != "https://panel.example/api" {
		t.Fatalf("base URL = %q", got)
	}
	t.Setenv("PIKPAK115_OPSPILOT_BASE_URL", "")
	t.Setenv("OPSPILOT_ADDR", "0.0.0.0:9090")
	if got := localOpsPilotBaseURL(); got != "http://127.0.0.1:9090" {
		t.Fatalf("local base URL = %q", got)
	}
	t.Setenv("PIKPAK115_BIN", "/opt/custom/pikpak-to-115")
	t.Setenv("PIKPAK115_ENV_FILE", "/etc/pikpak/custom.env")
	cmd := pikpak115FullCheckCommand(localOpsPilotBaseURL(), "test-token")
	wantArgs := []string{"/opt/custom/pikpak-to-115", "--env-file", "/etc/pikpak/custom.env", "full-check"}
	if strings.Join(cmd.Args, "\x00") != strings.Join(wantArgs, "\x00") {
		t.Fatalf("full-check argv = %#v, want %#v", cmd.Args, wantArgs)
	}
	joinedEnv := strings.Join(cmd.Env, "\n")
	if !strings.Contains(joinedEnv, "OPSPILOT_BASE_URL=http://127.0.0.1:9090") || !strings.Contains(joinedEnv, "OPSPILOT_TOKEN=test-token") {
		t.Fatalf("full-check environment missing callback values")
	}
}

func TestPikpakFullCheckBusyResponseDoesNotLeakPaths(t *testing.T) {
	app := &App{pikpakCheckBusy: true, pikpakCheckRunID: "run-123"}
	res := httptest.NewRecorder()
	app.triggerPikpak115FullCheck(res, httptest.NewRequest(http.MethodPost, "/api/pikpak-115/full-check", nil))
	if res.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusConflict)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if len(payload) != 2 || payload["ok"] != false || payload["run_id"] != "run-123" {
		t.Fatalf("unexpected redacted response: %#v", payload)
	}
}

func newTestApp(t *testing.T) *App {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	app := &App{db: db, token: "ingest-token", authConf: AuthConfig{Username: "opspilot", Password: "secret"}}
	if err := app.migrate(); err != nil {
		t.Fatal(err)
	}
	return app
}
