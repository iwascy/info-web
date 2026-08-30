package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	transferSchemaVersion = 1
	maxTransferCategories = 64
)

type sqlExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

type TransferSummary struct {
	CategoryCount  int               `json:"category_count"`
	Download       TransferAggregate `json:"download"`
	Upload         TransferAggregate `json:"upload"`
	DownloadSeries []int64           `json:"download_series,omitempty"`
	UploadSeries   []int64           `json:"upload_series,omitempty"`
}

type TransferAggregate struct {
	Status                string   `json:"status"`
	Progress              *float64 `json:"progress"`
	TotalItems            int64    `json:"total_items"`
	DoneItems             int64    `json:"done_items"`
	SuccessItems          int64    `json:"success_items"`
	FailedItems           int64    `json:"failed_items"`
	TotalBytes            int64    `json:"total_bytes"`
	DoneBytes             int64    `json:"done_bytes"`
	SpeedBPS              int64    `json:"speed_bps"`
	ChannelCount          int      `json:"channel_count"`
	IndeterminateChannels int      `json:"indeterminate_channels"`
	ExcludedChannels      int      `json:"excluded_channels"`
	ProgressBasis         string   `json:"progress_basis"`
	progressSum           float64
	progressCount         int
	byteChannels          int
	itemChannels          int
}

type TransferCategory struct {
	Key      string           `json:"key"`
	Name     string           `json:"name"`
	Order    int              `json:"order"`
	Download *TransferChannel `json:"download,omitempty"`
	Upload   *TransferChannel `json:"upload,omitempty"`
}

type TransferChannel struct {
	Status       string   `json:"status"`
	TotalItems   *int64   `json:"total_items"`
	DoneItems    *int64   `json:"done_items"`
	SuccessItems *int64   `json:"success_items"`
	FailedItems  *int64   `json:"failed_items"`
	TotalBytes   *int64   `json:"total_bytes"`
	DoneBytes    *int64   `json:"done_bytes"`
	SpeedBPS     *int64   `json:"speed_bps"`
	Progress     *float64 `json:"progress"`
	CurrentItem  *string  `json:"current_item"`
	Message      *string  `json:"message"`
	UpdatedAt    string   `json:"updated_at"`
}

type transferSnapshotRequest struct {
	SchemaVersion int                     `json:"schema_version"`
	Sequence      int64                   `json:"sequence"`
	ObservedAt    string                  `json:"observed_at"`
	Service       transferServiceInput    `json:"service"`
	Task          transferTaskInput       `json:"task"`
	Categories    []transferCategoryInput `json:"categories"`
}

type transferServiceInput struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type transferTaskInput struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Message   *string `json:"message"`
	StartedAt *string `json:"started_at"`
}

type transferCategoryInput struct {
	Key      string                `json:"key"`
	Name     string                `json:"name"`
	Order    int                   `json:"order"`
	Download *transferChannelInput `json:"download"`
	Upload   *transferChannelInput `json:"upload"`
}

type transferChannelInput struct {
	Status       string   `json:"status"`
	TotalItems   *int64   `json:"total_items"`
	DoneItems    *int64   `json:"done_items"`
	SuccessItems *int64   `json:"success_items"`
	FailedItems  *int64   `json:"failed_items"`
	TotalBytes   *int64   `json:"total_bytes"`
	DoneBytes    *int64   `json:"done_bytes"`
	SpeedBPS     *int64   `json:"speed_bps"`
	Progress     *float64 `json:"progress"`
	CurrentItem  *string  `json:"current_item"`
	Message      *string  `json:"message"`
}

func (a *App) postTransferProgress(w http.ResponseWriter, r *http.Request) {
	var p transferSnapshotRequest
	if !decode(w, r, &p) {
		return
	}
	if err := validateTransferSnapshot(&p); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if !requireIngestService(w, r, p.Service.Key) {
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if p.ObservedAt == "" {
		p.ObservedAt = now
	}
	accepted, previousStatus, err := a.persistTransferSnapshot(p, now)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	task, err := a.taskByID(p.Task.ID, true)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !accepted {
		writeJSON(w, map[string]any{"accepted": false, "reason": "stale_sequence", "task": task})
		return
	}

	if previousStatus == "" || previousStatus != p.Task.Status {
		raw, _ := json.Marshal(p)
		level := "info"
		if p.Task.Status == "error" {
			level = "error"
		} else if p.Task.Status == "success" {
			level = "success"
		}
		a.addEvent(p.Service.Key, &p.Task.ID, "progress", level, p.Task.Message, nil, task.Progress, task.Processed, task.Total, task.CurrentFile, &p.Task.Status, task.DownloadSpeed, task.UploadSpeed, raw)
	}
	if p.Task.Status == "error" {
		a.ensureAlert(p.Service.Key, &p.Task.ID, "high", "传输任务失败", val(p.Task.Message, "transfer error"))
	}
	_, _ = a.db.Exec("UPDATE alerts SET status='resolved', resolved_at=? WHERE task_id=? AND title=? AND status='firing'", now, p.Task.ID, staleTaskAlertTitle)
	writeJSON(w, map[string]any{"accepted": true, "task": task})
}

func validateTransferSnapshot(p *transferSnapshotRequest) error {
	if p.SchemaVersion == 0 {
		p.SchemaVersion = transferSchemaVersion
	}
	if p.SchemaVersion != transferSchemaVersion {
		return fmt.Errorf("unsupported schema_version: %d", p.SchemaVersion)
	}
	p.Service.Key = strings.TrimSpace(p.Service.Key)
	p.Service.Name = strings.TrimSpace(p.Service.Name)
	p.Task.ID = strings.TrimSpace(p.Task.ID)
	p.Task.Name = strings.TrimSpace(p.Task.Name)
	p.Task.Status = strings.TrimSpace(p.Task.Status)
	if p.Service.Key == "" || p.Task.ID == "" {
		return errors.New("service.key and task.id are required")
	}
	if len(p.Service.Key) > 128 || len(p.Task.ID) > 200 {
		return errors.New("service.key or task.id is too long")
	}
	if p.Service.Name == "" {
		p.Service.Name = p.Service.Key
	}
	if p.Task.Name == "" {
		p.Task.Name = p.Task.ID
	}
	if p.Task.Status == "" {
		p.Task.Status = "running"
	}
	if !validTransferTaskStatus(p.Task.Status) {
		return fmt.Errorf("invalid task status: %s", p.Task.Status)
	}
	if p.Sequence < 1 {
		return errors.New("sequence must be greater than zero")
	}
	if p.ObservedAt != "" {
		if _, err := time.Parse(time.RFC3339, p.ObservedAt); err != nil {
			return errors.New("observed_at must be RFC3339")
		}
	}
	if p.Task.StartedAt != nil && *p.Task.StartedAt != "" {
		if _, err := time.Parse(time.RFC3339, *p.Task.StartedAt); err != nil {
			return errors.New("task.started_at must be RFC3339")
		}
	}
	if len(p.Categories) == 0 || len(p.Categories) > maxTransferCategories {
		return fmt.Errorf("categories must contain 1-%d items", maxTransferCategories)
	}
	seen := make(map[string]struct{}, len(p.Categories))
	for i := range p.Categories {
		category := &p.Categories[i]
		category.Key = strings.TrimSpace(category.Key)
		category.Name = strings.TrimSpace(category.Name)
		if category.Key == "" {
			return fmt.Errorf("categories[%d].key is required", i)
		}
		if len(category.Key) > 128 {
			return fmt.Errorf("categories[%d].key is too long", i)
		}
		if _, ok := seen[category.Key]; ok {
			return fmt.Errorf("duplicate category key: %s", category.Key)
		}
		seen[category.Key] = struct{}{}
		if category.Name == "" {
			category.Name = category.Key
		}
		if category.Download == nil && category.Upload == nil {
			return fmt.Errorf("category %s must include download or upload", category.Key)
		}
		if err := validateTransferChannel("download", category.Key, category.Download); err != nil {
			return err
		}
		if err := validateTransferChannel("upload", category.Key, category.Upload); err != nil {
			return err
		}
	}
	return nil
}

func validTransferTaskStatus(status string) bool {
	switch status {
	case "running", "success", "error", "paused", "warning", "retry_waiting":
		return true
	default:
		return false
	}
}

func validateTransferChannel(direction, categoryKey string, channel *transferChannelInput) error {
	if channel == nil {
		return nil
	}
	if channel.Status == "" {
		channel.Status = "running"
	}
	switch channel.Status {
	case "pending", "running", "success", "error", "paused", "skipped", "unknown", "retry_waiting":
	default:
		return fmt.Errorf("invalid %s status for category %s", direction, categoryKey)
	}
	for name, value := range map[string]*int64{
		"total_items": channel.TotalItems, "done_items": channel.DoneItems,
		"success_items": channel.SuccessItems, "failed_items": channel.FailedItems,
		"total_bytes": channel.TotalBytes, "done_bytes": channel.DoneBytes, "speed_bps": channel.SpeedBPS,
	} {
		if value != nil && *value < 0 {
			return fmt.Errorf("%s.%s.%s must be non-negative", categoryKey, direction, name)
		}
	}
	if channel.TotalItems != nil && channel.DoneItems != nil && *channel.DoneItems > *channel.TotalItems {
		return fmt.Errorf("%s.%s.done_items exceeds total_items", categoryKey, direction)
	}
	if channel.TotalBytes != nil && channel.DoneBytes != nil && *channel.DoneBytes > *channel.TotalBytes {
		return fmt.Errorf("%s.%s.done_bytes exceeds total_bytes", categoryKey, direction)
	}
	if channel.Progress != nil && (*channel.Progress < 0 || *channel.Progress > 100) {
		return fmt.Errorf("%s.%s.progress must be between 0 and 100", categoryKey, direction)
	}
	channel.Progress = transferProgress(channel.TotalBytes, channel.DoneBytes, channel.TotalItems, channel.DoneItems, channel.Progress)
	return nil
}

func transferProgress(totalBytes, doneBytes, totalItems, doneItems *int64, fallback *float64) *float64 {
	if totalBytes != nil && *totalBytes > 0 && doneBytes != nil {
		value := round2(float64(*doneBytes) / float64(*totalBytes) * 100)
		return &value
	}
	if totalItems != nil && *totalItems > 0 && doneItems != nil {
		value := round2(float64(*doneItems) / float64(*totalItems) * 100)
		return &value
	}
	return fallback
}

func (a *App) persistTransferSnapshot(p transferSnapshotRequest, now string) (bool, string, error) {
	tx, err := a.db.Begin()
	if err != nil {
		return false, "", err
	}
	defer func() { _ = tx.Rollback() }()

	var currentSequence int64
	err = tx.QueryRow("SELECT sequence FROM transfer_snapshots WHERE task_id=?", p.Task.ID).Scan(&currentSequence)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, "", err
	}
	if err == nil && p.Sequence <= currentSequence {
		return false, "", nil
	}
	var previousStatus string
	_ = tx.QueryRow("SELECT status FROM sync_tasks WHERE task_id=?", p.Task.ID).Scan(&previousStatus)

	_, err = tx.Exec(`INSERT INTO services(service_key,name,type,status,message,last_progress_at,created_at)
VALUES(?,?,?,?,?,?,?)
ON CONFLICT(service_key) DO UPDATE SET name=excluded.name,status=excluded.status,message=excluded.message,last_progress_at=excluded.last_progress_at`,
		p.Service.Key, p.Service.Name, "sync", deriveServiceFromTask(p.Task.Status), p.Task.Message, now, now)
	if err != nil {
		return false, "", err
	}
	if _, err = tx.Exec("DELETE FROM transfer_channels WHERE task_id=?", p.Task.ID); err != nil {
		return false, "", err
	}
	if _, err = tx.Exec("DELETE FROM transfer_categories WHERE task_id=?", p.Task.ID); err != nil {
		return false, "", err
	}

	categories := make([]TransferCategory, 0, len(p.Categories))
	for _, input := range p.Categories {
		if _, err = tx.Exec("INSERT INTO transfer_categories(task_id,category_key,name,sort_order,updated_at) VALUES(?,?,?,?,?)", p.Task.ID, input.Key, input.Name, input.Order, now); err != nil {
			return false, "", err
		}
		category := TransferCategory{Key: input.Key, Name: input.Name, Order: input.Order}
		if input.Download != nil {
			category.Download = transferChannelFromInput(input.Download, now)
			if err = insertTransferChannel(tx, p.Task.ID, input.Key, "download", input.Download, now, p.ObservedAt); err != nil {
				return false, "", err
			}
		}
		if input.Upload != nil {
			category.Upload = transferChannelFromInput(input.Upload, now)
			if err = insertTransferChannel(tx, p.Task.ID, input.Key, "upload", input.Upload, now, p.ObservedAt); err != nil {
				return false, "", err
			}
		}
		categories = append(categories, category)
	}

	summary := summarizeTransferCategories(categories)
	representative := summary.Download
	stage := "download"
	if summary.Upload.ChannelCount > 0 {
		representative = summary.Upload
		stage = "upload"
	}
	currentFile := currentTransferItem(categories, stage)
	startedAt := now
	if p.Task.StartedAt != nil && *p.Task.StartedAt != "" {
		startedAt = *p.Task.StartedAt
	}
	_, err = tx.Exec(`INSERT INTO sync_tasks(service_key,task_id,name,status,stage,total,processed,success,failed,progress,message,started_at,updated_at,total_bytes,done_bytes,download_speed,upload_speed,current_file,current_stage)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(task_id) DO UPDATE SET service_key=excluded.service_key,name=excluded.name,status=excluded.status,stage=excluded.stage,
total=excluded.total,processed=excluded.processed,success=excluded.success,failed=excluded.failed,progress=excluded.progress,message=excluded.message,
updated_at=excluded.updated_at,total_bytes=excluded.total_bytes,done_bytes=excluded.done_bytes,download_speed=excluded.download_speed,
upload_speed=excluded.upload_speed,current_file=excluded.current_file,current_stage=excluded.current_stage`,
		p.Service.Key, p.Task.ID, p.Task.Name, normalizeTaskStatus(p.Task.Status), stage,
		nullableAggregate(representative.TotalItems), nullableAggregate(representative.DoneItems), nullableAggregate(representative.SuccessItems), nullableAggregate(representative.FailedItems), representative.Progress,
		p.Task.Message, startedAt, now, nullableAggregate(representative.TotalBytes), nullableAggregate(representative.DoneBytes),
		nullableAggregate(summary.Download.SpeedBPS), nullableAggregate(summary.Upload.SpeedBPS), currentFile, stage)
	if err != nil {
		return false, "", err
	}
	_, err = tx.Exec(`INSERT INTO transfer_snapshots(task_id,schema_version,sequence,observed_at,updated_at) VALUES(?,?,?,?,?)
ON CONFLICT(task_id) DO UPDATE SET schema_version=excluded.schema_version,sequence=excluded.sequence,observed_at=excluded.observed_at,updated_at=excluded.updated_at`,
		p.Task.ID, p.SchemaVersion, p.Sequence, p.ObservedAt, now)
	if err != nil {
		return false, "", err
	}
	_, _ = tx.Exec(`DELETE FROM transfer_samples WHERE id IN (
SELECT id FROM transfer_samples WHERE task_id=? ORDER BY id DESC LIMIT -1 OFFSET 1000
)`, p.Task.ID)
	if err = tx.Commit(); err != nil {
		return false, "", err
	}
	return true, previousStatus, nil
}

func insertTransferChannel(tx *sql.Tx, taskID, categoryKey, direction string, input *transferChannelInput, now, observedAt string) error {
	_, err := tx.Exec(`INSERT INTO transfer_channels(task_id,category_key,direction,status,total_items,done_items,success_items,failed_items,total_bytes,done_bytes,speed_bps,progress,current_item,message,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, taskID, categoryKey, direction, input.Status, input.TotalItems, input.DoneItems, input.SuccessItems,
		input.FailedItems, input.TotalBytes, input.DoneBytes, input.SpeedBPS, input.Progress, input.CurrentItem, input.Message, now)
	if err != nil {
		return err
	}
	_, err = tx.Exec("INSERT INTO transfer_samples(task_id,category_key,direction,speed_bps,progress,observed_at) VALUES(?,?,?,?,?,?)",
		taskID, categoryKey, direction, int64Value(input.SpeedBPS), input.Progress, observedAt)
	return err
}

func transferChannelFromInput(input *transferChannelInput, updatedAt string) *TransferChannel {
	return &TransferChannel{
		Status: input.Status, TotalItems: input.TotalItems, DoneItems: input.DoneItems, SuccessItems: input.SuccessItems,
		FailedItems: input.FailedItems, TotalBytes: input.TotalBytes, DoneBytes: input.DoneBytes, SpeedBPS: input.SpeedBPS,
		Progress: input.Progress, CurrentItem: input.CurrentItem, Message: input.Message, UpdatedAt: updatedAt,
	}
}

func nullableAggregate(value int64) any {
	if value == 0 {
		return nil
	}
	return value
}

func int64Value(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func currentTransferItem(categories []TransferCategory, direction string) *string {
	for _, category := range categories {
		channel := category.Download
		if direction == "upload" {
			channel = category.Upload
		}
		if channel != nil && channel.CurrentItem != nil && *channel.CurrentItem != "" {
			return channel.CurrentItem
		}
	}
	return nil
}

func summarizeTransferCategories(categories []TransferCategory) TransferSummary {
	summary := TransferSummary{CategoryCount: len(categories)}
	for _, category := range categories {
		addTransferAggregate(&summary.Download, category.Download)
		addTransferAggregate(&summary.Upload, category.Upload)
	}
	finishTransferAggregate(&summary.Download)
	finishTransferAggregate(&summary.Upload)
	return summary
}

func addTransferAggregate(aggregate *TransferAggregate, channel *TransferChannel) {
	if channel == nil {
		return
	}
	aggregate.ChannelCount++
	aggregate.TotalItems += int64Value(channel.TotalItems)
	aggregate.DoneItems += int64Value(channel.DoneItems)
	aggregate.SuccessItems += int64Value(channel.SuccessItems)
	aggregate.FailedItems += int64Value(channel.FailedItems)
	aggregate.TotalBytes += int64Value(channel.TotalBytes)
	aggregate.DoneBytes += int64Value(channel.DoneBytes)
	aggregate.SpeedBPS += int64Value(channel.SpeedBPS)
	if (channel.TotalBytes == nil || *channel.TotalBytes == 0) && (channel.TotalItems == nil || *channel.TotalItems == 0) && channel.Progress == nil {
		aggregate.IndeterminateChannels++
	}
	if channel.Progress != nil {
		aggregate.progressSum += *channel.Progress
		aggregate.progressCount++
	}
	if channel.TotalBytes != nil && *channel.TotalBytes > 0 && channel.DoneBytes != nil {
		aggregate.byteChannels++
	}
	if channel.TotalItems != nil && *channel.TotalItems > 0 && channel.DoneItems != nil {
		aggregate.itemChannels++
	}
	aggregate.Status = mergeTransferStatus(aggregate.Status, channel.Status)
}

func finishTransferAggregate(aggregate *TransferAggregate) {
	switch {
	case aggregate.byteChannels == aggregate.ChannelCount && aggregate.TotalBytes > 0:
		value := round2(float64(aggregate.DoneBytes) / float64(aggregate.TotalBytes) * 100)
		aggregate.Progress = &value
		aggregate.ProgressBasis = "bytes"
	case aggregate.itemChannels == aggregate.ChannelCount && aggregate.TotalItems > 0:
		value := round2(float64(aggregate.DoneItems) / float64(aggregate.TotalItems) * 100)
		aggregate.Progress = &value
		aggregate.ProgressBasis = "items"
	case aggregate.byteChannels >= aggregate.itemChannels && aggregate.byteChannels > 0:
		value := round2(float64(aggregate.DoneBytes) / float64(aggregate.TotalBytes) * 100)
		aggregate.Progress = &value
		aggregate.ProgressBasis = "bytes"
		aggregate.ExcludedChannels = aggregate.ChannelCount - aggregate.byteChannels
	case aggregate.itemChannels > 0:
		value := round2(float64(aggregate.DoneItems) / float64(aggregate.TotalItems) * 100)
		aggregate.Progress = &value
		aggregate.ProgressBasis = "items"
		aggregate.ExcludedChannels = aggregate.ChannelCount - aggregate.itemChannels
	case aggregate.progressCount > 0:
		value := round2(aggregate.progressSum / float64(aggregate.progressCount))
		aggregate.Progress = &value
		aggregate.ProgressBasis = "reported"
		aggregate.ExcludedChannels = aggregate.ChannelCount - aggregate.progressCount
	}
	if aggregate.Status == "" {
		aggregate.Status = "unknown"
	}
}

func mergeTransferStatus(current, next string) string {
	rank := map[string]int{"error": 8, "retry_waiting": 7, "running": 6, "warning": 5, "paused": 4, "pending": 3, "unknown": 2, "success": 1, "skipped": 0}
	if current == "" || rank[next] > rank[current] {
		return next
	}
	return current
}

func (a *App) fillTransferDetail(task *SyncTask) {
	rows, err := a.db.Query(`SELECT c.category_key,c.name,c.sort_order,ch.direction,ch.status,ch.total_items,ch.done_items,ch.success_items,ch.failed_items,ch.total_bytes,ch.done_bytes,ch.speed_bps,ch.progress,ch.current_item,ch.message,ch.updated_at
FROM transfer_categories c JOIN transfer_channels ch ON ch.task_id=c.task_id AND ch.category_key=c.category_key
WHERE c.task_id=? ORDER BY c.sort_order,c.category_key,CASE ch.direction WHEN 'download' THEN 0 ELSE 1 END`, task.TaskID)
	if err != nil {
		return
	}
	defer rows.Close()
	byKey := map[string]*TransferCategory{}
	order := []string{}
	for rows.Next() {
		var key, name, direction string
		var sortOrder int
		channel := &TransferChannel{}
		if err := rows.Scan(&key, &name, &sortOrder, &direction, &channel.Status, &channel.TotalItems, &channel.DoneItems, &channel.SuccessItems,
			&channel.FailedItems, &channel.TotalBytes, &channel.DoneBytes, &channel.SpeedBPS, &channel.Progress, &channel.CurrentItem, &channel.Message, &channel.UpdatedAt); err != nil {
			return
		}
		category := byKey[key]
		if category == nil {
			category = &TransferCategory{Key: key, Name: name, Order: sortOrder}
			byKey[key] = category
			order = append(order, key)
		}
		if direction == "download" {
			category.Download = channel
		} else {
			category.Upload = channel
		}
	}
	for _, key := range order {
		task.TransferCategories = append(task.TransferCategories, *byKey[key])
	}
	if len(task.TransferCategories) == 0 {
		return
	}
	summary := summarizeTransferCategories(task.TransferCategories)
	summary.DownloadSeries, summary.UploadSeries = a.transferAggregateSeries(task.TaskID)
	task.TransferSummary = &summary
	if isPikpak115Task(task.ServiceKey, task.TaskID) {
		for i := range task.TransferCategories {
			if task.TransferCategories[i].Download != nil && task.TransferCategories[i].Download.CurrentItem != nil {
				task.TransferCategories[i].Download.CurrentItem = strPtr(hiddenFileName)
			}
			if task.TransferCategories[i].Upload != nil && task.TransferCategories[i].Upload.CurrentItem != nil {
				task.TransferCategories[i].Upload.CurrentItem = strPtr(hiddenFileName)
			}
		}
	}
}

func (a *App) transferAggregateSeries(taskID string) ([]int64, []int64) {
	rows, err := a.db.Query(`SELECT observed_at,
SUM(CASE WHEN direction='download' THEN speed_bps ELSE 0 END),
SUM(CASE WHEN direction='upload' THEN speed_bps ELSE 0 END)
FROM transfer_samples WHERE task_id=? GROUP BY observed_at ORDER BY observed_at DESC LIMIT 30`, taskID)
	if err != nil {
		return nil, nil
	}
	defer rows.Close()
	download, upload := []int64{}, []int64{}
	for rows.Next() {
		var observedAt string
		var dl, ul int64
		if rows.Scan(&observedAt, &dl, &ul) == nil {
			download = append([]int64{dl}, download...)
			upload = append([]int64{ul}, upload...)
		}
	}
	return download, upload
}

func (a *App) deleteTaskDetails(db sqlExecer, taskID string) error {
	for _, table := range []string{
		"account_health", "recent_files", "error_samples", "batch_records",
		"transfer_samples", "transfer_channels", "transfer_categories", "transfer_snapshots",
	} {
		if _, err := db.Exec("DELETE FROM "+table+" WHERE task_id=?", taskID); err != nil {
			return err
		}
	}
	return nil
}
