package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestTransferProgressStoresDynamicCategoriesAndAggregatesDirections(t *testing.T) {
	app := newTestApp(t)
	body := `{
  "schema_version":1,
  "sequence":1,
  "observed_at":"2026-08-30T12:00:00Z",
  "service":{"key":"multi-transfer","name":"多分类传输"},
  "task":{"id":"run-001","name":"每日任务","status":"running","message":"传输中"},
  "categories":[
    {"key":"a","name":"A 类","order":1,
      "download":{"status":"running","total_bytes":1000,"done_bytes":400,"speed_bps":100},
      "upload":{"status":"running","total_bytes":1000,"done_bytes":300,"speed_bps":50}},
    {"key":"b","name":"B 类","order":2,
      "download":{"status":"success","total_bytes":1000,"done_bytes":1000,"speed_bps":0}}
  ]
}`
	res := postTransferSnapshot(t, app, body)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}

	task, err := app.taskByID("run-001", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(task.TransferCategories) != 2 || task.TransferCategories[0].Name != "A 类" || task.TransferCategories[1].Name != "B 类" {
		t.Fatalf("unexpected categories: %+v", task.TransferCategories)
	}
	if task.TransferSummary == nil || task.TransferSummary.Download.Progress == nil || *task.TransferSummary.Download.Progress != 70 {
		t.Fatalf("download aggregate = %+v, want 70%%", task.TransferSummary)
	}
	if task.TransferSummary.Upload.Progress == nil || *task.TransferSummary.Upload.Progress != 30 {
		t.Fatalf("upload aggregate = %+v, want 30%%", task.TransferSummary.Upload)
	}
	if task.DownloadSpeed == nil || *task.DownloadSpeed != 100 || task.UploadSpeed == nil || *task.UploadSpeed != 50 {
		t.Fatalf("task speed summary = %v/%v", task.DownloadSpeed, task.UploadSpeed)
	}
}

func TestTransferAggregateChoosesTheBasisWithTheBestCoverage(t *testing.T) {
	itemsTotal, itemsDone := int64(100), int64(50)
	bytesTotal, bytesDone := int64(1000), int64(400)
	reported := 25.0
	categories := []TransferCategory{
		{Key: "a", Download: &TransferChannel{TotalBytes: &bytesTotal, DoneBytes: &bytesDone, Progress: floatPtr(40)}},
		{Key: "b", Download: &TransferChannel{TotalItems: &itemsTotal, DoneItems: &itemsDone, Progress: floatPtr(50)}},
		{Key: "c", Download: &TransferChannel{TotalItems: &itemsTotal, DoneItems: &itemsDone, Progress: floatPtr(50)}},
		{Key: "d", Download: &TransferChannel{Progress: &reported}},
	}
	summary := summarizeTransferCategories(categories)
	if summary.Download.ProgressBasis != "items" || summary.Download.Progress == nil || *summary.Download.Progress != 50 {
		t.Fatalf("unexpected mixed-basis aggregate: %+v", summary.Download)
	}
	if summary.Download.ExcludedChannels != 2 {
		t.Fatalf("excluded channels = %d, want 2", summary.Download.ExcludedChannels)
	}
}

func floatPtr(value float64) *float64 { return &value }

func TestTransferProgressRejectsStaleSequenceAndReplacesCategorySnapshot(t *testing.T) {
	app := newTestApp(t)
	first := `{"schema_version":1,"sequence":2,"service":{"key":"svc","name":"Svc"},"task":{"id":"run","name":"Run","status":"running"},"categories":[{"key":"a","name":"A","download":{"status":"running","progress":60}},{"key":"b","name":"B","download":{"status":"running","progress":20}}]}`
	if res := postTransferSnapshot(t, app, first); res.Code != http.StatusOK {
		t.Fatalf("first snapshot failed: %s", res.Body.String())
	}
	stale := `{"schema_version":1,"sequence":1,"service":{"key":"svc","name":"Svc"},"task":{"id":"run","name":"Run","status":"running"},"categories":[{"key":"a","name":"A","download":{"status":"running","progress":10}}]}`
	res := postTransferSnapshot(t, app, stale)
	var staleResult struct {
		Accepted bool `json:"accepted"`
	}
	if err := json.NewDecoder(res.Body).Decode(&staleResult); err != nil {
		t.Fatal(err)
	}
	if staleResult.Accepted {
		t.Fatal("stale snapshot was accepted")
	}
	task, _ := app.taskByID("run", true)
	if len(task.TransferCategories) != 2 {
		t.Fatalf("stale snapshot changed categories: %+v", task.TransferCategories)
	}

	replacement := `{"schema_version":1,"sequence":3,"service":{"key":"svc","name":"Svc"},"task":{"id":"run","name":"Run","status":"success"},"categories":[{"key":"a","name":"A 类","download":{"status":"success","progress":100}}]}`
	if res := postTransferSnapshot(t, app, replacement); res.Code != http.StatusOK {
		t.Fatalf("replacement failed: %s", res.Body.String())
	}
	task, _ = app.taskByID("run", true)
	if len(task.TransferCategories) != 1 || task.TransferCategories[0].Name != "A 类" {
		t.Fatalf("full snapshot did not replace categories: %+v", task.TransferCategories)
	}
}

func TestTransferProgressValidatesCountersAndOnlyLogsLifecycleEvents(t *testing.T) {
	app := newTestApp(t)
	invalid := `{"schema_version":1,"sequence":1,"service":{"key":"svc"},"task":{"id":"bad","status":"running"},"categories":[{"key":"a","download":{"status":"running","total_bytes":10,"done_bytes":11}}]}`
	if res := postTransferSnapshot(t, app, invalid); res.Code != http.StatusBadRequest {
		t.Fatalf("invalid counters status = %d, want 400", res.Code)
	}

	for _, body := range []string{
		`{"schema_version":1,"sequence":1,"service":{"key":"svc"},"task":{"id":"events","status":"running"},"categories":[{"key":"a","download":{"status":"running","progress":10}}]}`,
		`{"schema_version":1,"sequence":2,"service":{"key":"svc"},"task":{"id":"events","status":"running"},"categories":[{"key":"a","download":{"status":"running","progress":20}}]}`,
		`{"schema_version":1,"sequence":3,"service":{"key":"svc"},"task":{"id":"events","status":"success"},"categories":[{"key":"a","download":{"status":"success","progress":100}}]}`,
	} {
		if res := postTransferSnapshot(t, app, body); res.Code != http.StatusOK {
			t.Fatalf("snapshot failed: %s", res.Body.String())
		}
	}
	var count int
	if err := app.db.QueryRow("SELECT COUNT(*) FROM events WHERE task_id='events'").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("lifecycle event count = %d, want 2", count)
	}
}

func TestDeleteServiceRemovesTransferDataAndIntegration(t *testing.T) {
	app := newTestApp(t)
	issueTestIntegration(t, app, "delete-me")
	body := `{"schema_version":1,"sequence":1,"service":{"key":"delete-me"},"task":{"id":"delete-run","status":"running"},"categories":[{"key":"a","download":{"status":"running","progress":10}}]}`
	if res := postTransferSnapshot(t, app, body); res.Code != http.StatusOK {
		t.Fatalf("snapshot failed: %s", res.Body.String())
	}
	router := chi.NewRouter()
	router.Delete("/api/services/{key}", app.deleteService)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest(http.MethodDelete, "/api/services/delete-me", nil))
	if res.Code != http.StatusOK {
		t.Fatalf("delete failed: %d %s", res.Code, res.Body.String())
	}
	for _, table := range []string{"services", "sync_tasks", "transfer_snapshots", "transfer_categories", "transfer_channels", "transfer_samples", "ingest_integrations"} {
		var count int
		if err := app.db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s retained %d rows after service deletion", table, count)
		}
	}
}

func postTransferSnapshot(t *testing.T, app *App, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/transfer-progress", strings.NewReader(body))
	res := httptest.NewRecorder()
	app.postTransferProgress(res, req)
	return res
}
