package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "modernc.org/sqlite"
)

const defaultToken = "opspilot-dev-token"
const hiddenFileName = "文件名已隐藏"

type App struct {
	db    *sql.DB
	token string
}

type Service struct {
	ID                  int64   `json:"id"`
	ServiceKey          string  `json:"service_key"`
	Name                string  `json:"name"`
	Type                string  `json:"type"`
	Status              string  `json:"status"`
	Message             *string `json:"message"`
	LastHeartbeatAt     *string `json:"last_heartbeat_at"`
	LastProgressAt      *string `json:"last_progress_at"`
	HeartbeatTimeoutSec int64   `json:"heartbeat_timeout_sec"`
	CreatedAt           string  `json:"created_at"`
	Progress            *int64  `json:"progress,omitempty"`
}

type SyncTask struct {
	ID             int64     `json:"id"`
	ServiceKey     string    `json:"service_key"`
	TaskID         string    `json:"task_id"`
	Name           string    `json:"name"`
	Status         string    `json:"status"`
	Stage          *string   `json:"stage"`
	Total          *int64    `json:"total"`
	Processed      *int64    `json:"processed"`
	Success        *int64    `json:"success"`
	Failed         *int64    `json:"failed"`
	Skipped        *int64    `json:"skipped"`
	Progress       *float64  `json:"progress"`
	Message        *string   `json:"message"`
	StartedAt      *string   `json:"started_at"`
	UpdatedAt      string    `json:"updated_at"`
	TotalBytes     *int64    `json:"total_bytes"`
	DoneBytes      *int64    `json:"done_bytes"`
	InstantFiles   *int64    `json:"instant_files"`
	UploadedFiles  *int64    `json:"uploaded_files"`
	QueueSize      *int64    `json:"queue_size"`
	Cursor         *string   `json:"cursor"`
	DownloadSpeed  *int64    `json:"download_speed"`
	UploadSpeed    *int64    `json:"upload_speed"`
	CurrentFile    *string   `json:"current_file"`
	CurrentStage   *string   `json:"current_stage"`
	WindowStart    *string   `json:"window_start"`
	WindowEnd      *string   `json:"window_end"`
	WindowEnabled  *bool     `json:"window_enabled"`
	DownloadSeries []int64   `json:"download_series,omitempty"`
	UploadSeries   []int64   `json:"upload_series,omitempty"`
	Stages         []Stage   `json:"stages,omitempty"`
	Batches        []Batch   `json:"batches,omitempty"`
	ErrorSamples   []ErrSam  `json:"error_samples,omitempty"`
	RecentFiles    []File    `json:"recent_files,omitempty"`
	Accounts       []Account `json:"accounts,omitempty"`
}

type Event struct {
	ID            int64            `json:"id"`
	ServiceKey    string           `json:"service_key"`
	TaskID        *string          `json:"task_id"`
	Type          string           `json:"type"`
	Level         string           `json:"level"`
	Message       *string          `json:"message"`
	Stage         *string          `json:"stage"`
	Percentage    *float64         `json:"percentage"`
	Current       *int64           `json:"current"`
	Total         *int64           `json:"total"`
	FileName      *string          `json:"file_name"`
	Status        *string          `json:"status"`
	DownloadSpeed *int64           `json:"download_speed"`
	UploadSpeed   *int64           `json:"upload_speed"`
	RawPayload    json.RawMessage  `json:"raw_payload"`
	CreatedAt     string           `json:"created_at"`
	Raw           *json.RawMessage `json:"raw,omitempty"`
}

type Alert struct {
	ID          int64   `json:"id"`
	ServiceKey  string  `json:"service_key"`
	TaskID      *string `json:"task_id"`
	Severity    string  `json:"severity"`
	Title       string  `json:"title"`
	Message     string  `json:"message"`
	Status      string  `json:"status"`
	TriggeredAt string  `json:"triggered_at"`
	ResolvedAt  *string `json:"resolved_at"`
}

type Stage struct {
	Key      string   `json:"key"`
	Name     string   `json:"name"`
	Status   string   `json:"status"`
	Progress *float64 `json:"progress,omitempty"`
	Meta     *string  `json:"meta,omitempty"`
}

type Account struct {
	ID         int64   `json:"id"`
	TaskID     string  `json:"task_id"`
	Side       string  `json:"side"`
	Label      string  `json:"label"`
	Account    string  `json:"account"`
	UsedBytes  int64   `json:"used_bytes"`
	TotalBytes int64   `json:"total_bytes"`
	Unit       string  `json:"unit"`
	Note       *string `json:"note"`
	OK         bool    `json:"ok"`
}

type Batch struct {
	ID        int64  `json:"id"`
	TaskID    string `json:"task_id"`
	Range     string `json:"range"`
	Total     int64  `json:"total"`
	Success   int64  `json:"success"`
	Failed    int64  `json:"failed"`
	Duration  string `json:"duration"`
	CreatedAt string `json:"created_at"`
}

type ErrSam struct {
	ID        int64           `json:"id"`
	TaskID    string          `json:"task_id"`
	File      string          `json:"file"`
	Code      string          `json:"code"`
	Reason    string          `json:"reason"`
	Level     string          `json:"level"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt string          `json:"created_at"`
}

type File struct {
	ID            int64   `json:"id"`
	TaskID        string  `json:"task_id"`
	Name          string  `json:"name"`
	Size          int64   `json:"size"`
	Path          string  `json:"path"`
	Status        string  `json:"status"`
	DownloadSpeed *int64  `json:"download_speed"`
	UploadSpeed   *int64  `json:"upload_speed"`
	Duration      *string `json:"duration"`
	CreatedAt     string  `json:"created_at"`
}

func main() {
	seed := flag.Bool("seed", false, "seed demo data and exit")
	flag.Parse()

	dbPath := env("OPSPILOT_DB", "data/opspilot.sqlite")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatal(err)
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	app := &App{db: db, token: env("OPSPILOT_TOKEN", defaultToken)}
	if err := app.migrate(); err != nil {
		log.Fatal(err)
	}
	if *seed {
		if err := app.seed(); err != nil {
			log.Fatal(err)
		}
		log.Printf("seeded %s", dbPath)
		return
	}
	go app.alertLoop()

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", app.ok)
		r.With(app.auth).Post("/heartbeat", app.postHeartbeat)
		r.With(app.auth).Post("/progress", app.postProgress)
		r.Get("/dashboard", app.getDashboard)
		r.Get("/services", app.getServices)
		r.With(app.auth).Post("/services", app.createService)
		r.Get("/services/{key}", app.getService)
		r.With(app.auth).Delete("/services/{key}", app.deleteService)
		r.Get("/sync-tasks", app.getSyncTasks)
		r.Get("/sync-tasks/{id}", app.getSyncTask)
		r.With(app.auth).Post("/sync-tasks/{id}/pause", app.pauseTask)
		r.With(app.auth).Post("/sync-tasks/{id}/resume", app.resumeTask)
		r.Get("/alerts", app.getAlerts)
		r.With(app.auth).Post("/alerts/resolve-all", app.resolveAllAlerts)
		r.With(app.auth).Post("/alerts/{id}/resolve", app.resolveAlert)
		r.With(app.auth).Post("/alerts/{id}/mute", app.muteAlert)
		r.Get("/events", app.getEvents)
		r.Get("/settings", app.getSettings)
		r.With(app.auth).Put("/settings", app.putSettings)
		r.With(app.auth).Post("/token/reset", app.resetToken)
	})

	addr := env("OPSPILOT_ADDR", ":8080")
	log.Printf("OpsPilot API on %s, db=%s", addr, dbPath)
	log.Fatal(http.ListenAndServe(addr, r))
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

func (a *App) migrate() error {
	_, err := a.db.Exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'worker',
  status TEXT NOT NULL DEFAULT 'unknown',
  message TEXT,
  last_heartbeat_at TEXT,
  last_progress_at TEXT,
  heartbeat_timeout_sec INTEGER NOT NULL DEFAULT 90,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_key TEXT NOT NULL,
  task_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  stage TEXT,
  total INTEGER, processed INTEGER, success INTEGER, failed INTEGER, skipped INTEGER,
  progress REAL, message TEXT,
  started_at TEXT, updated_at TEXT NOT NULL,
  total_bytes INTEGER, done_bytes INTEGER, instant_files INTEGER, uploaded_files INTEGER, queue_size INTEGER,
  cursor TEXT, download_speed INTEGER, upload_speed INTEGER, current_file TEXT, current_stage TEXT,
  window_start TEXT, window_end TEXT, window_enabled INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_key TEXT NOT NULL,
  task_id TEXT,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT,
  stage TEXT,
  percentage REAL,
  current INTEGER,
  total INTEGER,
  file_name TEXT,
  status TEXT,
  download_speed INTEGER,
  upload_speed INTEGER,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_key TEXT NOT NULL,
  task_id TEXT,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'firing',
  triggered_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS batch_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  range_label TEXT NOT NULL,
  total INTEGER NOT NULL,
  success INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  duration TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS error_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  file TEXT NOT NULL,
  code TEXT NOT NULL,
  reason TEXT NOT NULL,
  level TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  download_speed INTEGER,
  upload_speed INTEGER,
  duration TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  side TEXT NOT NULL,
  label TEXT NOT NULL,
  account TEXT NOT NULL,
  used_bytes INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'bytes',
  note TEXT,
  ok INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, triggered_at DESC);
`)
	if err != nil {
		return err
	}
	_, _ = a.db.Exec("ALTER TABLE recent_files ADD COLUMN download_speed INTEGER")
	_, _ = a.db.Exec("ALTER TABLE recent_files ADD COLUMN upload_speed INTEGER")
	_, _ = a.db.Exec("INSERT OR IGNORE INTO settings(key,value) VALUES ('token', ?), ('auto_refresh', 'true'), ('alert_progress_stale_min', '10')", a.token)
	return nil
}

func (a *App) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		var token string
		_ = a.db.QueryRow("SELECT value FROM settings WHERE key='token'").Scan(&token)
		if token == "" {
			token = a.token
		}
		if got == "" || got != token {
			writeErr(w, http.StatusUnauthorized, "invalid bearer token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) ok(w http.ResponseWriter, r *http.Request) { writeJSON(w, map[string]any{"ok": true}) }

func (a *App) postHeartbeat(w http.ResponseWriter, r *http.Request) {
	var p struct {
		ServiceKey string  `json:"service_key"`
		Status     string  `json:"status"`
		Message    *string `json:"message"`
		Name       *string `json:"name"`
		Type       *string `json:"type"`
	}
	if !decode(w, r, &p) {
		return
	}
	if p.ServiceKey == "" || p.Status == "" {
		writeErr(w, 400, "service_key and status are required")
		return
	}
	now := time.Now().Format(time.RFC3339)
	name := p.ServiceKey
	if p.Name != nil && *p.Name != "" {
		name = *p.Name
	}
	typ := "worker"
	if p.Type != nil && *p.Type != "" {
		typ = *p.Type
	}
	_, err := a.db.Exec(`INSERT INTO services(service_key,name,type,status,message,last_heartbeat_at,created_at)
VALUES(?,?,?,?,?,?,?)
ON CONFLICT(service_key) DO UPDATE SET status=excluded.status,message=excluded.message,last_heartbeat_at=excluded.last_heartbeat_at`,
		p.ServiceKey, name, typ, normalizeServiceStatus(p.Status), p.Message, now, now)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	raw, _ := json.Marshal(p)
	level := "info"
	if p.Status == "error" {
		level = "error"
	}
	a.addEvent(p.ServiceKey, nil, "heartbeat", level, p.Message, nil, nil, nil, nil, nil, &p.Status, nil, nil, raw)
	if p.Status == "error" {
		a.ensureAlert(p.ServiceKey, nil, "high", val(p.Message, "服务心跳异常"), val(p.Message, "heartbeat error"))
	}
	writeJSON(w, must(a.serviceByKey(p.ServiceKey)))
}

func (a *App) postProgress(w http.ResponseWriter, r *http.Request) {
	var p map[string]any
	if !decode(w, r, &p) {
		return
	}
	serviceKey, _ := p["service_key"].(string)
	taskID, _ := p["task_id"].(string)
	if serviceKey == "" || taskID == "" {
		writeErr(w, 400, "service_key and task_id are required")
		return
	}
	now := time.Now().Format(time.RFC3339)
	name := strFrom(p, "name", strFrom(p, "task_name", taskID))
	status := strFrom(p, "status", "running")
	progress := floatFrom(p, "progress")
	if progress == nil {
		total, processed := intFrom(p, "total"), intFrom(p, "processed")
		if total != nil && *total > 0 && processed != nil {
			v := float64(*processed) / float64(*total) * 100
			progress = &v
		}
	}
	if err := a.ensureService(serviceKey, serviceKey, "sync"); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	started := strPtrFrom(p, "started_at")
	if started == nil {
		started = &now
	}
	_, err := a.db.Exec(`INSERT INTO sync_tasks(
service_key,task_id,name,status,stage,total,processed,success,failed,skipped,progress,message,started_at,updated_at,
total_bytes,done_bytes,instant_files,uploaded_files,queue_size,cursor,download_speed,upload_speed,current_file,current_stage,window_start,window_end,window_enabled)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(task_id) DO UPDATE SET
service_key=excluded.service_key,name=excluded.name,status=excluded.status,stage=excluded.stage,total=excluded.total,
processed=excluded.processed,success=excluded.success,failed=excluded.failed,skipped=excluded.skipped,progress=excluded.progress,
message=excluded.message,updated_at=excluded.updated_at,total_bytes=excluded.total_bytes,done_bytes=excluded.done_bytes,
instant_files=excluded.instant_files,uploaded_files=excluded.uploaded_files,queue_size=excluded.queue_size,cursor=excluded.cursor,
download_speed=excluded.download_speed,upload_speed=excluded.upload_speed,current_file=excluded.current_file,current_stage=excluded.current_stage,
window_start=excluded.window_start,window_end=excluded.window_end,window_enabled=excluded.window_enabled`,
		serviceKey, taskID, name, normalizeTaskStatus(status), strPtrFrom(p, "stage"), intFrom(p, "total"), intFrom(p, "processed"),
		intFrom(p, "success"), intFrom(p, "failed"), intFrom(p, "skipped"), progress, strPtrFrom(p, "message"), started, now,
		intFrom(p, "total_bytes"), intFrom(p, "done_bytes"), intFrom(p, "instant_files"), intFrom(p, "uploaded_files"),
		intFrom(p, "queue_size"), anyStringPtr(p, "cursor"), intFrom(p, "download_speed"), intFrom(p, "upload_speed"),
		strPtrFrom(p, "current_file"), strPtrFrom(p, "current_stage"), strPtrFrom(p, "window_start"), strPtrFrom(p, "window_end"), boolIntPtr(p, "window_enabled"))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	msg := strPtrFrom(p, "message")
	level := "info"
	if status == "error" {
		level = "error"
	} else if status == "success" {
		level = "success"
	}
	raw, _ := json.Marshal(p)
	a.addEvent(serviceKey, &taskID, "progress", level, msg, strPtrFrom(p, "stage"), progress, intFrom(p, "processed"), intFrom(p, "total"), strPtrFrom(p, "file_name"), &status, intFrom(p, "download_speed"), intFrom(p, "upload_speed"), raw)
	_, _ = a.db.Exec("UPDATE services SET status=?, message=?, last_progress_at=? WHERE service_key=?", deriveServiceFromTask(status), msg, now, serviceKey)
	if status == "error" {
		a.ensureAlert(serviceKey, &taskID, "high", val(msg, "同步任务失败"), val(msg, "progress error"))
	}
	writeJSON(w, must(a.taskByID(taskID, true)))
}

func (a *App) getDashboard(w http.ResponseWriter, r *http.Request) {
	a.checkAlerts()
	services, _ := a.listServices()
	tasks, _ := a.listTasks(false)
	alerts, _ := a.listAlerts("firing")
	counts := map[string]int{"healthy": 0, "running": 0, "warning": 0, "error": 0, "unknown": 0, "paused": 0}
	for _, s := range services {
		counts[s.Status]++
	}
	var completed int
	var synced int64
	for _, t := range tasks {
		if t.Status == "success" {
			completed++
		}
		if t.DoneBytes != nil {
			synced += *t.DoneBytes
		}
	}
	writeJSON(w, map[string]any{
		"total_services":        len(services),
		"healthy":               counts["healthy"],
		"running":               counts["running"],
		"warning":               counts["warning"],
		"error":                 counts["error"],
		"unknown":               counts["unknown"],
		"paused":                counts["paused"],
		"today_alerts":          len(alerts),
		"today_completed_tasks": completed,
		"total_synced_bytes":    synced,
		"uptime_pct":            99.62,
		"avg_latency_ms":        86,
		"services":              services,
		"sync_tasks":            tasks,
		"alerts":                alerts,
		"sys": map[string]any{
			"cpu":  map[string]any{"value": 23, "series": []int{18, 21, 19, 24, 22, 26, 23, 20, 25, 28, 24, 22, 19, 23, 27, 25, 23, 21, 24, 23}},
			"mem":  map[string]any{"value": 58, "series": []int{52, 54, 55, 53, 56, 58, 60, 59, 57, 58, 61, 60, 58, 56, 57, 59, 58, 60, 58, 58}},
			"disk": map[string]any{"value": 42, "series": []int{40, 41, 41, 42, 42, 43, 42, 41, 42, 44, 43, 42, 42, 41, 42, 43, 42, 42, 41, 42}},
			"net":  map[string]any{"value": 12.8, "series": []float64{8, 9, 11, 10, 12, 14, 13, 11, 12, 15, 13, 12, 10, 12, 14, 13, 12, 11, 13, 12.8}},
		},
	})
}

func (a *App) getServices(w http.ResponseWriter, r *http.Request) {
	services, err := a.listServices()
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, services)
}

func (a *App) createService(w http.ResponseWriter, r *http.Request) {
	var p struct {
		ServiceKey          string  `json:"service_key"`
		Name                string  `json:"name"`
		Type                string  `json:"type"`
		HeartbeatTimeoutSec *int64  `json:"heartbeat_timeout_sec"`
		Message             *string `json:"message"`
	}
	if !decode(w, r, &p) {
		return
	}
	if p.ServiceKey == "" || p.Name == "" {
		writeErr(w, 400, "service_key and name are required")
		return
	}
	timeout := int64(90)
	if p.HeartbeatTimeoutSec != nil {
		timeout = *p.HeartbeatTimeoutSec
	}
	_, err := a.db.Exec(`INSERT INTO services(service_key,name,type,status,message,heartbeat_timeout_sec,created_at)
VALUES(?,?,?,?,?,?,?)`, p.ServiceKey, p.Name, strDefault(p.Type, "worker"), "unknown", p.Message, timeout, time.Now().Format(time.RFC3339))
	if err != nil {
		writeErr(w, 409, err.Error())
		return
	}
	writeJSON(w, must(a.serviceByKey(p.ServiceKey)))
}

func (a *App) getService(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	s, err := a.serviceByKey(key)
	if err != nil {
		writeErr(w, 404, "service not found")
		return
	}
	events, _ := a.listEvents("service_key", key, "", 40)
	tasks, _ := a.tasksByService(key)
	writeJSON(w, map[string]any{"service": s, "events": events, "sync_tasks": tasks})
}

func (a *App) deleteService(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	_, _ = a.db.Exec("DELETE FROM services WHERE service_key=?", key)
	writeJSON(w, map[string]any{"ok": true})
}

func (a *App) getSyncTasks(w http.ResponseWriter, r *http.Request) {
	tasks, err := a.listTasks(false)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, tasks)
}

func (a *App) getSyncTask(w http.ResponseWriter, r *http.Request) {
	t, err := a.taskByID(chi.URLParam(r, "id"), true)
	if err != nil {
		writeErr(w, 404, "sync task not found")
		return
	}
	writeJSON(w, t)
}

func (a *App) pauseTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, _ = a.db.Exec("UPDATE sync_tasks SET status='paused', message='用户手动暂停', updated_at=? WHERE task_id=? OR id=?", time.Now().Format(time.RFC3339), id, id)
	writeJSON(w, must(a.taskByID(id, true)))
}

func (a *App) resumeTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, _ = a.db.Exec("UPDATE sync_tasks SET status='running', message='已恢复运行', updated_at=? WHERE task_id=? OR id=?", time.Now().Format(time.RFC3339), id, id)
	writeJSON(w, must(a.taskByID(id, true)))
}

func (a *App) getAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := a.listAlerts(r.URL.Query().Get("status"))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, alerts)
}

func (a *App) resolveAlert(w http.ResponseWriter, r *http.Request) {
	now := time.Now().Format(time.RFC3339)
	_, _ = a.db.Exec("UPDATE alerts SET status='resolved', resolved_at=? WHERE id=?", now, chi.URLParam(r, "id"))
	writeJSON(w, map[string]any{"ok": true})
}

func (a *App) resolveAllAlerts(w http.ResponseWriter, r *http.Request) {
	now := time.Now().Format(time.RFC3339)
	res, err := a.db.Exec("UPDATE alerts SET status='resolved', resolved_at=? WHERE status='firing'", now)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	count, _ := res.RowsAffected()
	writeJSON(w, map[string]any{"ok": true, "resolved": count})
}

func (a *App) muteAlert(w http.ResponseWriter, r *http.Request) {
	_, _ = a.db.Exec("UPDATE alerts SET status='muted' WHERE id=?", chi.URLParam(r, "id"))
	writeJSON(w, map[string]any{"ok": true})
}

func (a *App) getEvents(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 300 {
		limit = 100
	}
	events, err := a.listEvents("", "", r.URL.Query().Get("type"), limit)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	q := strings.ToLower(r.URL.Query().Get("q"))
	if q != "" {
		filtered := events[:0]
		for _, e := range events {
			if strings.Contains(strings.ToLower(e.ServiceKey), q) || (e.Message != nil && strings.Contains(strings.ToLower(*e.Message), q)) || strings.Contains(strings.ToLower(string(e.RawPayload)), q) {
				filtered = append(filtered, e)
			}
		}
		events = filtered
	}
	writeJSON(w, events)
}

func (a *App) getSettings(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query("SELECT key,value FROM settings")
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		_ = rows.Scan(&k, &v)
		out[k] = v
	}
	writeJSON(w, out)
}

func (a *App) putSettings(w http.ResponseWriter, r *http.Request) {
	var p map[string]string
	if !decode(w, r, &p) {
		return
	}
	for k, v := range p {
		_, _ = a.db.Exec("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", k, v)
	}
	a.getSettings(w, r)
}

func (a *App) resetToken(w http.ResponseWriter, r *http.Request) {
	token := "op_" + strings.ReplaceAll(time.Now().Format("20060102150405.000000000"), ".", "")
	_, _ = a.db.Exec("INSERT INTO settings(key,value) VALUES('token',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", token)
	writeJSON(w, map[string]string{"token": token})
}

func (a *App) listServices() ([]Service, error) {
	a.checkAlerts()
	rows, err := a.db.Query(`SELECT id,service_key,name,type,status,message,last_heartbeat_at,last_progress_at,heartbeat_timeout_sec,created_at FROM services`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Service
	for rows.Next() {
		var s Service
		if err := rows.Scan(&s.ID, &s.ServiceKey, &s.Name, &s.Type, &s.Status, &s.Message, &s.LastHeartbeatAt, &s.LastProgressAt, &s.HeartbeatTimeoutSec, &s.CreatedAt); err != nil {
			return nil, err
		}
		var pct sql.NullInt64
		_ = a.db.QueryRow("SELECT CAST(progress AS INTEGER) FROM sync_tasks WHERE service_key=? ORDER BY updated_at DESC LIMIT 1", s.ServiceKey).Scan(&pct)
		if pct.Valid {
			s.Progress = &pct.Int64
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool {
		oi, oj := serviceOrder(out[i].Status), serviceOrder(out[j].Status)
		if oi != oj {
			return oi < oj
		}
		return out[i].ServiceKey < out[j].ServiceKey
	})
	return out, nil
}

func (a *App) serviceByKey(key string) (Service, error) {
	var s Service
	err := a.db.QueryRow(`SELECT id,service_key,name,type,status,message,last_heartbeat_at,last_progress_at,heartbeat_timeout_sec,created_at FROM services WHERE service_key=?`, key).
		Scan(&s.ID, &s.ServiceKey, &s.Name, &s.Type, &s.Status, &s.Message, &s.LastHeartbeatAt, &s.LastProgressAt, &s.HeartbeatTimeoutSec, &s.CreatedAt)
	return s, err
}

func (a *App) listTasks(detail bool) ([]SyncTask, error) {
	rows, err := a.db.Query(`SELECT id,service_key,task_id,name,status,stage,total,processed,success,failed,skipped,progress,message,started_at,updated_at,total_bytes,done_bytes,instant_files,uploaded_files,queue_size,cursor,download_speed,upload_speed,current_file,current_stage,window_start,window_end,window_enabled FROM sync_tasks`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SyncTask
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		if detail {
			a.fillTaskDetail(&t)
		}
		redactTaskFileNames(&t)
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool {
		oi, oj := taskOrder(out[i].Status), taskOrder(out[j].Status)
		if oi != oj {
			return oi < oj
		}
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	return out, nil
}

func (a *App) taskByID(id string, detail bool) (SyncTask, error) {
	row := a.db.QueryRow(`SELECT id,service_key,task_id,name,status,stage,total,processed,success,failed,skipped,progress,message,started_at,updated_at,total_bytes,done_bytes,instant_files,uploaded_files,queue_size,cursor,download_speed,upload_speed,current_file,current_stage,window_start,window_end,window_enabled FROM sync_tasks WHERE task_id=? OR id=?`, id, id)
	t, err := scanTask(row)
	if err != nil {
		return t, err
	}
	if detail {
		a.fillTaskDetail(&t)
	}
	redactTaskFileNames(&t)
	return t, nil
}

func (a *App) tasksByService(key string) ([]SyncTask, error) {
	rows, err := a.db.Query(`SELECT id,service_key,task_id,name,status,stage,total,processed,success,failed,skipped,progress,message,started_at,updated_at,total_bytes,done_bytes,instant_files,uploaded_files,queue_size,cursor,download_speed,upload_speed,current_file,current_stage,window_start,window_end,window_enabled FROM sync_tasks WHERE service_key=?`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SyncTask
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		redactTaskFileNames(&t)
		out = append(out, t)
	}
	return out, nil
}

type scanner interface{ Scan(dest ...any) error }

func scanTask(row scanner) (SyncTask, error) {
	var t SyncTask
	var win sql.NullInt64
	err := row.Scan(&t.ID, &t.ServiceKey, &t.TaskID, &t.Name, &t.Status, &t.Stage, &t.Total, &t.Processed, &t.Success, &t.Failed, &t.Skipped, &t.Progress, &t.Message, &t.StartedAt, &t.UpdatedAt, &t.TotalBytes, &t.DoneBytes, &t.InstantFiles, &t.UploadedFiles, &t.QueueSize, &t.Cursor, &t.DownloadSpeed, &t.UploadSpeed, &t.CurrentFile, &t.CurrentStage, &t.WindowStart, &t.WindowEnd, &win)
	if win.Valid {
		b := win.Int64 != 0
		t.WindowEnabled = &b
	}
	return t, err
}

func (a *App) fillTaskDetail(t *SyncTask) {
	if strings.Contains(t.TaskID, "pikpak") || strings.Contains(t.ServiceKey, "pikpak") {
		t.Stages = stageFlow([]Stage{{Key: "scan", Name: "扫描 PikPak"}, {Key: "download", Name: "下载 / 中转"}, {Key: "upload", Name: "上传 115"}, {Key: "verify", Name: "sha1 校验"}, {Key: "done", Name: "完成"}}, val(t.CurrentStage, val(t.Stage, "")), t.Status, t.Progress)
		t.Accounts = a.listAccounts(t.TaskID)
	} else {
		t.Stages = stageFlow([]Stage{{Key: "connect", Name: "连接源"}, {Key: "extract", Name: "增量抽取"}, {Key: "cleaning", Name: "数据清洗", Progress: t.Progress}, {Key: "writing", Name: "写入目标"}, {Key: "verify", Name: "数据校验"}}, val(t.Stage, ""), t.Status, t.Progress)
	}
	t.DownloadSeries, t.UploadSeries = a.throughputSeries(t.TaskID)
	t.Batches = a.listBatches(t.TaskID)
	t.ErrorSamples = a.listErrorSamples(t.TaskID)
	t.RecentFiles = a.listRecentFiles(t.TaskID)
}

func stageFlow(stages []Stage, current, taskStatus string, progress *float64) []Stage {
	currentIdx := -1
	for i := range stages {
		if stages[i].Key == current {
			currentIdx = i
			break
		}
	}
	if currentIdx < 0 && progress != nil && *progress >= 100 {
		currentIdx = len(stages) - 1
	}
	for i := range stages {
		switch {
		case taskStatus == "success":
			stages[i].Status = "done"
		case taskStatus == "error" && i == currentIdx:
			stages[i].Status = "error"
		case i < currentIdx:
			stages[i].Status = "done"
		case i == currentIdx && taskStatus == "running":
			stages[i].Status = "running"
		case i == currentIdx && taskStatus == "paused":
			stages[i].Status = "paused"
		default:
			stages[i].Status = "pending"
		}
	}
	return stages
}

func (a *App) listBatches(taskID string) []Batch {
	rows, err := a.db.Query("SELECT id,task_id,range_label,total,success,failed,duration,created_at FROM batch_records WHERE task_id=? ORDER BY id DESC LIMIT 20", taskID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Batch
	for rows.Next() {
		var b Batch
		_ = rows.Scan(&b.ID, &b.TaskID, &b.Range, &b.Total, &b.Success, &b.Failed, &b.Duration, &b.CreatedAt)
		out = append(out, b)
	}
	return out
}

func (a *App) listErrorSamples(taskID string) []ErrSam {
	rows, err := a.db.Query("SELECT id,task_id,file,code,reason,level,payload,created_at FROM error_samples WHERE task_id=? ORDER BY id DESC LIMIT 20", taskID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []ErrSam
	for rows.Next() {
		var e ErrSam
		var payload string
		_ = rows.Scan(&e.ID, &e.TaskID, &e.File, &e.Code, &e.Reason, &e.Level, &payload, &e.CreatedAt)
		e.Payload = json.RawMessage(payload)
		out = append(out, e)
	}
	return out
}

func (a *App) listRecentFiles(taskID string) []File {
	rows, err := a.db.Query("SELECT id,task_id,name,size,path,status,download_speed,upload_speed,duration,created_at FROM recent_files WHERE task_id=? ORDER BY id DESC LIMIT 20", taskID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []File
	for rows.Next() {
		var f File
		_ = rows.Scan(&f.ID, &f.TaskID, &f.Name, &f.Size, &f.Path, &f.Status, &f.DownloadSpeed, &f.UploadSpeed, &f.Duration, &f.CreatedAt)
		out = append(out, f)
	}
	return out
}

func (a *App) listAccounts(taskID string) []Account {
	rows, err := a.db.Query("SELECT id,task_id,side,label,account,used_bytes,total_bytes,unit,note,ok FROM account_health WHERE task_id=? ORDER BY CASE side WHEN 'source' THEN 0 ELSE 1 END", taskID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Account
	for rows.Next() {
		var ac Account
		var ok int64
		_ = rows.Scan(&ac.ID, &ac.TaskID, &ac.Side, &ac.Label, &ac.Account, &ac.UsedBytes, &ac.TotalBytes, &ac.Unit, &ac.Note, &ok)
		ac.OK = ok != 0
		out = append(out, ac)
	}
	return out
}

func (a *App) throughputSeries(taskID string) ([]int64, []int64) {
	rows, err := a.db.Query("SELECT download_speed, upload_speed FROM events WHERE task_id=? AND (download_speed IS NOT NULL OR upload_speed IS NOT NULL) ORDER BY created_at DESC LIMIT 30", taskID)
	if err != nil {
		return nil, nil
	}
	defer rows.Close()
	var dlRev, ulRev []int64
	for rows.Next() {
		var dl, ul sql.NullInt64
		_ = rows.Scan(&dl, &ul)
		if dl.Valid {
			dlRev = append(dlRev, dl.Int64/1048576)
		}
		if ul.Valid {
			ulRev = append(ulRev, ul.Int64/1048576)
		}
	}
	reverse(dlRev)
	reverse(ulRev)
	return dlRev, ulRev
}

func reverse(xs []int64) {
	for i, j := 0, len(xs)-1; i < j; i, j = i+1, j-1 {
		xs[i], xs[j] = xs[j], xs[i]
	}
}

func (a *App) listAlerts(status string) ([]Alert, error) {
	q := "SELECT id,service_key,task_id,severity,title,message,status,triggered_at,resolved_at FROM alerts"
	args := []any{}
	if status != "" && status != "all" {
		q += " WHERE status=?"
		args = append(args, status)
	}
	q += " ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, triggered_at DESC"
	rows, err := a.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Alert
	for rows.Next() {
		var al Alert
		if err := rows.Scan(&al.ID, &al.ServiceKey, &al.TaskID, &al.Severity, &al.Title, &al.Message, &al.Status, &al.TriggeredAt, &al.ResolvedAt); err != nil {
			return nil, err
		}
		out = append(out, al)
	}
	return out, nil
}

func (a *App) listEvents(field, value, typ string, limit int) ([]Event, error) {
	q := "SELECT id,service_key,task_id,type,level,message,stage,percentage,current,total,file_name,status,download_speed,upload_speed,raw_payload,created_at FROM events"
	args := []any{}
	where := []string{}
	if field != "" {
		where = append(where, field+"=?")
		args = append(args, value)
	}
	if typ != "" && typ != "all" {
		where = append(where, "type=?")
		args = append(args, typ)
	}
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}
	q += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, limit)
	rows, err := a.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Event
	for rows.Next() {
		var e Event
		var raw string
		if err := rows.Scan(&e.ID, &e.ServiceKey, &e.TaskID, &e.Type, &e.Level, &e.Message, &e.Stage, &e.Percentage, &e.Current, &e.Total, &e.FileName, &e.Status, &e.DownloadSpeed, &e.UploadSpeed, &raw, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.RawPayload = json.RawMessage(raw)
		redactEventFileNames(&e)
		out = append(out, e)
	}
	return out, nil
}

func redactTaskFileNames(t *SyncTask) {
	if !isPikpak115Task(t.ServiceKey, t.TaskID) {
		return
	}
	if t.CurrentFile != nil {
		t.CurrentFile = strPtr(hiddenFileName)
	}
	for i := range t.ErrorSamples {
		t.ErrorSamples[i].File = hiddenFileName
		t.ErrorSamples[i].Payload = redactRawPayload(t.ErrorSamples[i].Payload)
	}
	for i := range t.RecentFiles {
		t.RecentFiles[i].Name = hiddenFileName
	}
}

func redactEventFileNames(e *Event) {
	if !isPikpak115Event(e.ServiceKey, e.TaskID) {
		return
	}
	if e.FileName != nil {
		e.FileName = strPtr(hiddenFileName)
	}
	e.RawPayload = redactRawPayload(e.RawPayload)
}

func redactRawPayload(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return raw
	}
	redactPayloadValue(v)
	out, err := json.Marshal(v)
	if err != nil {
		return raw
	}
	return json.RawMessage(out)
}

func redactPayloadValue(v any) {
	switch x := v.(type) {
	case map[string]any:
		for k, child := range x {
			if isFileNameKey(k) {
				x[k] = hiddenFileName
				continue
			}
			redactPayloadValue(child)
		}
	case []any:
		for _, child := range x {
			redactPayloadValue(child)
		}
	}
}

func isFileNameKey(k string) bool {
	switch strings.ToLower(k) {
	case "current_file", "file_name", "filename", "file":
		return true
	default:
		return false
	}
}

func isPikpak115Task(serviceKey, taskID string) bool {
	text := strings.ToLower(serviceKey + " " + taskID)
	return strings.Contains(text, "pikpak") && strings.Contains(text, "115")
}

func isPikpak115Event(serviceKey string, taskID *string) bool {
	task := ""
	if taskID != nil {
		task = *taskID
	}
	return isPikpak115Task(serviceKey, task)
}

func (a *App) ensureService(serviceKey, name, typ string) error {
	_, err := a.db.Exec(`INSERT INTO services(service_key,name,type,status,created_at) VALUES(?,?,?,?,?)
ON CONFLICT(service_key) DO NOTHING`, serviceKey, name, typ, "unknown", time.Now().Format(time.RFC3339))
	return err
}

func (a *App) addEvent(serviceKey string, taskID *string, typ, level string, msg, stage *string, pct *float64, current, total *int64, fileName, status *string, dl, ul *int64, raw []byte) {
	_, _ = a.db.Exec(`INSERT INTO events(service_key,task_id,type,level,message,stage,percentage,current,total,file_name,status,download_speed,upload_speed,raw_payload,created_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, serviceKey, taskID, typ, level, msg, stage, pct, current, total, fileName, status, dl, ul, string(raw), time.Now().Format(time.RFC3339))
}

func (a *App) alertLoop() {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	for range t.C {
		a.checkAlerts()
	}
}

func (a *App) checkAlerts() {
	rows, err := a.db.Query("SELECT service_key,last_heartbeat_at,heartbeat_timeout_sec FROM services WHERE status!='paused'")
	if err != nil {
		return
	}
	defer rows.Close()
	now := time.Now()
	for rows.Next() {
		var key string
		var last *string
		var timeout int64
		_ = rows.Scan(&key, &last, &timeout)
		if last == nil {
			continue
		}
		t, err := time.Parse(time.RFC3339, *last)
		if err == nil && now.Sub(t) > time.Duration(timeout)*time.Second {
			_, _ = a.db.Exec("UPDATE services SET status='error', message=? WHERE service_key=?", "心跳超时", key)
			a.ensureAlert(key, nil, "high", "服务心跳超时", fmt.Sprintf("超过 %d 秒未收到心跳", timeout))
		}
	}
	taskRows, err := a.db.Query("SELECT service_key,task_id,updated_at,failed,total,status FROM sync_tasks WHERE status='running'")
	if err != nil {
		return
	}
	defer taskRows.Close()
	for taskRows.Next() {
		var key, taskID, updated, status string
		var failed, total *int64
		_ = taskRows.Scan(&key, &taskID, &updated, &failed, &total, &status)
		t, err := time.Parse(time.RFC3339, updated)
		if err == nil && now.Sub(t) > 10*time.Minute {
			a.ensureAlert(key, &taskID, "medium", "任务长时间无进度更新", "running 任务疑似卡住")
		}
		if failed != nil && total != nil && *total > 0 && float64(*failed)/float64(*total) > 0.01 {
			a.ensureAlert(key, &taskID, "medium", "失败率超过阈值", "失败率超过 1%")
		}
	}
}

func (a *App) ensureAlert(serviceKey string, taskID *string, severity, title, msg string) {
	var id int64
	err := a.db.QueryRow("SELECT id FROM alerts WHERE service_key=? AND IFNULL(task_id,'')=IFNULL(?,'') AND title=? AND status='firing'", serviceKey, taskID, title).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		_, _ = a.db.Exec("INSERT INTO alerts(service_key,task_id,severity,title,message,status,triggered_at) VALUES(?,?,?,?,?,'firing',?)", serviceKey, taskID, severity, title, msg, time.Now().Format(time.RFC3339))
	}
}

func (a *App) seed() error {
	_, _ = a.db.Exec("DELETE FROM account_health; DELETE FROM recent_files; DELETE FROM error_samples; DELETE FROM batch_records; DELETE FROM alerts; DELETE FROM events; DELETE FROM sync_tasks; DELETE FROM services;")
	now := time.Now()
	services := []Service{
		{ServiceKey: "order-sync", Name: "订单同步服务", Type: "sync", Status: "error"},
		{ServiceKey: "user-api", Name: "用户服务 API", Type: "api", Status: "healthy"},
		{ServiceKey: "product-crawler", Name: "商品爬虫服务", Type: "crawler", Status: "running"},
		{ServiceKey: "inventory-sync", Name: "库存同步服务", Type: "sync", Status: "error"},
		{ServiceKey: "report-generator", Name: "报表生成服务", Type: "script", Status: "healthy"},
		{ServiceKey: "data-cleaner", Name: "数据清洗服务", Type: "script", Status: "running"},
		{ServiceKey: "embedding-agent", Name: "向量化 Agent", Type: "agent", Status: "unknown"},
		{ServiceKey: "pikpak-115-sg2", Name: "PikPak → 115 网盘迁移", Type: "sync", Status: "running"},
	}
	for i, s := range services {
		hb := now.Add(-time.Duration(20+i*8) * time.Second).Format(time.RFC3339)
		if s.Status == "unknown" {
			_, _ = a.db.Exec("INSERT INTO services(service_key,name,type,status,message,heartbeat_timeout_sec,created_at) VALUES(?,?,?,?,?,?,?)", s.ServiceKey, s.Name, s.Type, s.Status, "等待首次上报", 90, now.Add(-48*time.Hour).Format(time.RFC3339))
			continue
		}
		msg := "running"
		if s.Status == "error" {
			msg = "数据库写入失败，已重试 3 次"
		}
		_, _ = a.db.Exec("INSERT INTO services(service_key,name,type,status,message,last_heartbeat_at,heartbeat_timeout_sec,created_at) VALUES(?,?,?,?,?,?,?,?)", s.ServiceKey, s.Name, s.Type, s.Status, msg, hb, 3600, now.Add(-48*time.Hour).Format(time.RFC3339))
	}
	tasks := []map[string]any{
		{"service_key": "order-sync", "task_id": "sync_order_001", "name": "订单数据同步任务", "status": "running", "stage": "cleaning", "total": int64(320000000), "processed": int64(217600000), "success": int64(215800000), "failed": int64(1320000), "skipped": int64(480000), "progress": 68.0, "message": "正在清洗订单数据"},
		{"service_key": "user-api", "task_id": "sync_user_001", "name": "用户索引同步", "status": "running", "stage": "writing", "total": int64(12000000), "processed": int64(5040000), "success": int64(5039000), "failed": int64(1000), "progress": 42.0, "message": "写入 Elasticsearch"},
		{"service_key": "inventory-sync", "task_id": "sync_inventory_001", "name": "库存同步", "status": "error", "stage": "writing", "total": int64(9000000), "processed": int64(2070000), "success": int64(2061000), "failed": int64(9000), "progress": 23.0, "message": "目标表写入超时"},
		{"service_key": "report-generator", "task_id": "sync_report_009", "name": "日报数据归档", "status": "success", "stage": "verify", "total": int64(4200000), "processed": int64(4200000), "success": int64(4200000), "failed": int64(0), "progress": 100.0, "message": "已完成"},
		{"service_key": "pikpak-115-sg2", "task_id": "pikpak_115_main", "name": "PikPak → 115 网盘迁移", "status": "running", "stage": "upload", "total": int64(50480), "processed": int64(37965), "success": int64(37965), "failed": int64(249), "skipped": int64(0), "progress": 75.2, "message": "正在上传至 115", "total_bytes": int64(6597069766656), "done_bytes": int64(4810363371520), "instant_files": int64(24130), "uploaded_files": int64(13835), "queue_size": int64(12017), "cursor": "1184273", "download_speed": int64(41 * 1048576), "upload_speed": int64(28 * 1048576), "current_file": "剧集/SomeShow.S07/E12.2160p.HDR.DV.mkv", "current_stage": "upload", "window_start": "02:00", "window_end": "08:00", "window_enabled": true},
	}
	for _, p := range tasks {
		b, _ := json.Marshal(p)
		req, _ := http.NewRequest("POST", "/api/progress", strings.NewReader(string(b)))
		req.Header.Set("Content-Type", "application/json")
		rr := &discardResponse{h: http.Header{}}
		a.postProgress(rr, req)
	}
	dlSeries := []int64{36, 38, 34, 40, 42, 39, 44, 41, 37, 45, 43, 40, 38, 42, 41, 39, 43, 41, 44, 40, 38, 41}
	ulSeries := []int64{22, 25, 21, 27, 29, 24, 30, 28, 23, 31, 27, 26, 24, 29, 28, 25, 30, 27, 29, 26, 25, 28}
	for i := range dlSeries {
		raw, _ := json.Marshal(map[string]any{"sample": i, "download_speed": dlSeries[i] * 1048576, "upload_speed": ulSeries[i] * 1048576})
		msg := "吞吐采样"
		stage := "upload"
		status := "running"
		created := now.Add(-time.Duration(len(dlSeries)-i) * 15 * time.Second).Format(time.RFC3339)
		_, _ = a.db.Exec(`INSERT INTO events(service_key,task_id,type,level,message,stage,status,download_speed,upload_speed,raw_payload,created_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?)`, "pikpak-115-sg2", "pikpak_115_main", "progress", "info", msg, stage, status, dlSeries[i]*1048576, ulSeries[i]*1048576, string(raw), created)
	}
	a.ensureAlert("order-sync", strPtr("sync_order_001"), "high", "数据库写入失败，已重试 3 次", "ClickHouse timeout after 10s")
	a.ensureAlert("data-cleaner", nil, "medium", "任务 10 分钟无进度更新", "running 任务疑似卡住")
	a.ensureAlert("inventory-sync", strPtr("sync_inventory_001"), "high", "目标表写入超时", "SQL Server → ClickHouse 写入超时")
	for i := 138; i >= 134; i-- {
		_, _ = a.db.Exec("INSERT INTO batch_records(task_id,range_label,total,success,failed,duration,created_at) VALUES(?,?,?,?,?,?,?)", "sync_order_001", fmt.Sprintf("2026-06 #%d", i), 2400000, 2390000+int64(i), 6000, "2m 51s", now.Add(-time.Duration(138-i)*4*time.Minute).Format(time.RFC3339))
	}
	samples := []ErrSam{
		{TaskID: "sync_order_001", File: "order_id=80021922", Code: "CH_TIMEOUT", Reason: "ClickHouse timeout (10s)", Level: "error", Payload: json.RawMessage(`{"retry_count":3,"host":"ch-node-2"}`)},
		{TaskID: "pikpak_115_main", File: "OST.flac.zip", Code: "rate_limited", Reason: "115 上传限流（HTTP 429），已自动暂停并重排队", Level: "warning", Payload: json.RawMessage(`{"stage":"upload","http_status":429,"retry_after":120,"action":"pause_and_requeue"}`)},
		{TaskID: "pikpak_115_main", File: "oldpack.rar", Code: "source_gone", Reason: "PikPak 源文件已失效（404），无法下载", Level: "error", Payload: json.RawMessage(`{"stage":"download","http_status":404}`)},
	}
	for _, e := range samples {
		_, _ = a.db.Exec("INSERT INTO error_samples(task_id,file,code,reason,level,payload,created_at) VALUES(?,?,?,?,?,?,?)", e.TaskID, e.File, e.Code, e.Reason, e.Level, string(e.Payload), now.Format(time.RFC3339))
	}
	accounts := []Account{
		{TaskID: "pikpak_115_main", Side: "source", Label: "PikPak（来源）", Account: "pp****@gmail.com", UsedBytes: bytesTB(3.2), TotalBytes: bytesTB(5), Unit: "traffic", Note: strPtr("token 6 天后过期"), OK: true},
		{TaskID: "pikpak_115_main", Side: "target", Label: "115 网盘（目标）", Account: "115****8821", UsedBytes: bytesTB(4.37), TotalBytes: bytesTB(10), Unit: "quota", Note: strPtr("秒传命中 63.6%"), OK: true},
	}
	for _, ac := range accounts {
		ok := 0
		if ac.OK {
			ok = 1
		}
		_, _ = a.db.Exec("INSERT INTO account_health(task_id,side,label,account,used_bytes,total_bytes,unit,note,ok) VALUES(?,?,?,?,?,?,?,?,?)", ac.TaskID, ac.Side, ac.Label, ac.Account, ac.UsedBytes, ac.TotalBytes, ac.Unit, ac.Note, ok)
	}
	dl41 := int64(41 * 1048576)
	ul28 := int64(28 * 1048576)
	dl38 := int64(38 * 1048576)
	ul26 := int64(26 * 1048576)
	dl33 := int64(33 * 1048576)
	ul24 := int64(24 * 1048576)
	files := []File{
		{TaskID: "pikpak_115_main", Name: "E12.2160p.HDR.DV.mkv", Size: bytesGB(18.4), Path: "upload", Status: "running", DownloadSpeed: &dl41, UploadSpeed: &ul28},
		{TaskID: "pikpak_115_main", Name: "E11.2160p.HDR.mkv", Size: bytesGB(16.1), Path: "instant", Status: "success", Duration: strPtr("00:02")},
		{TaskID: "pikpak_115_main", Name: "E10.1080p.x265.mkv", Size: bytesGB(4.2), Path: "instant", Status: "success", Duration: strPtr("00:01")},
		{TaskID: "pikpak_115_main", Name: "番外.Bonus.2160p.mkv", Size: bytesGB(9.8), Path: "download", Status: "success", DownloadSpeed: &dl38, UploadSpeed: &ul26, Duration: strPtr("06:48")},
		{TaskID: "pikpak_115_main", Name: "API-relay.sample.mkv", Size: bytesGB(2.6), Path: "relay", Status: "success", DownloadSpeed: &dl33, UploadSpeed: &ul24, Duration: strPtr("03:18")},
		{TaskID: "pikpak_115_main", Name: "OST.flac.zip", Size: 612 * 1048576, Path: "download", Status: "error", DownloadSpeed: &dl33, UploadSpeed: &ul24},
	}
	for _, f := range files {
		_, _ = a.db.Exec("INSERT INTO recent_files(task_id,name,size,path,status,download_speed,upload_speed,duration,created_at) VALUES(?,?,?,?,?,?,?,?,?)", f.TaskID, f.Name, f.Size, f.Path, f.Status, f.DownloadSpeed, f.UploadSpeed, f.Duration, now.Format(time.RFC3339))
	}
	return nil
}

type discardResponse struct {
	h http.Header
}

func (d *discardResponse) Header() http.Header         { return http.Header(d.h) }
func (d *discardResponse) Write(b []byte) (int, error) { return len(b), nil }
func (d *discardResponse) WriteHeader(statusCode int)  {}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeErr(w, 400, "invalid json")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func normalizeServiceStatus(s string) string {
	switch s {
	case "ok", "healthy", "success":
		return "healthy"
	case "running", "warning", "error", "unknown", "paused":
		return s
	default:
		return "unknown"
	}
}

func normalizeTaskStatus(s string) string {
	switch s {
	case "ok", "healthy", "success":
		return "success"
	case "running", "warning", "error", "paused":
		return s
	default:
		return "running"
	}
}

func deriveServiceFromTask(s string) string {
	switch s {
	case "error":
		return "error"
	case "paused":
		return "paused"
	case "success":
		return "healthy"
	default:
		return "running"
	}
}

func serviceOrder(s string) int {
	return map[string]int{"error": 0, "warning": 1, "running": 2, "unknown": 3, "healthy": 4, "paused": 5}[s]
}

func taskOrder(s string) int {
	return map[string]int{"error": 0, "running": 1, "warning": 2, "success": 3, "paused": 4}[s]
}

func val(s *string, fallback string) string {
	if s != nil && *s != "" {
		return *s
	}
	return fallback
}

func strDefault(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func strPtr(s string) *string { return &s }

func bytesGB(v float64) int64 { return int64(v * 1073741824) }

func bytesTB(v float64) int64 { return int64(v * 1099511627776) }

func strPtrFrom(m map[string]any, k string) *string {
	if v, ok := m[k].(string); ok && v != "" {
		return &v
	}
	return nil
}

func strFrom(m map[string]any, k, fallback string) string {
	if v, ok := m[k].(string); ok && v != "" {
		return v
	}
	return fallback
}

func anyStringPtr(m map[string]any, k string) *string {
	if v, ok := m[k]; ok {
		s := fmt.Sprint(v)
		return &s
	}
	return nil
}

func intFrom(m map[string]any, k string) *int64 {
	v, ok := m[k]
	if !ok || v == nil {
		return nil
	}
	switch x := v.(type) {
	case float64:
		i := int64(x)
		return &i
	case int64:
		return &x
	case string:
		if i, err := strconv.ParseInt(x, 10, 64); err == nil {
			return &i
		}
	}
	return nil
}

func floatFrom(m map[string]any, k string) *float64 {
	v, ok := m[k]
	if !ok || v == nil {
		return nil
	}
	switch x := v.(type) {
	case float64:
		return &x
	case string:
		if f, err := strconv.ParseFloat(x, 64); err == nil {
			return &f
		}
	}
	return nil
}

func boolIntPtr(m map[string]any, k string) *int {
	v, ok := m[k]
	if !ok {
		return nil
	}
	out := 0
	if b, ok := v.(bool); ok && b {
		out = 1
	}
	return &out
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}
