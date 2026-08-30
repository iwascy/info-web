export type ServiceStatus = "healthy" | "running" | "warning" | "error" | "unknown" | "paused";
export type TaskStatus = "running" | "stale" | "success" | "error" | "paused" | "warning" | "retry_waiting";

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<string, number>;
}

export interface CountResponse {
  count: number;
}

export interface Service {
  id: number;
  service_key: string;
  name: string;
  type: "sync" | "api" | "crawler" | "script" | "agent" | "worker";
  status: ServiceStatus;
  message: string | null;
  last_heartbeat_at: string | null;
  last_progress_at: string | null;
  heartbeat_timeout_sec: number;
  created_at: string;
  progress?: number | null;
}

export interface SyncTask {
  id: number;
  service_key: string;
  task_id: string;
  name: string;
  status: TaskStatus;
  stage: string | null;
  total: number | null;
  processed: number | null;
  success: number | null;
  failed: number | null;
  skipped: number | null;
  progress: number | null;
  message: string | null;
  started_at: string | null;
  updated_at: string;
  total_bytes: number | null;
  done_bytes: number | null;
  instant_files: number | null;
  uploaded_files: number | null;
  queue_size: number | null;
  cursor: string | null;
  download_speed: number | null;
  upload_speed: number | null;
  current_file: string | null;
  current_stage: string | null;
  window_start: string | null;
  window_end: string | null;
  window_enabled: boolean | null;
  attempt?: number | null;
  max_attempts?: number | null;
  retry_count?: number | null;
  next_attempt_at?: string | null;
  last_error?: string | null;
  dead_letter?: boolean | null;
  download_series?: number[];
  upload_series?: number[];
  stages?: Stage[];
  batches?: BatchRecord[];
  error_samples?: ErrorSample[];
  recent_files?: RecentFile[];
  accounts?: AccountHealth[];
  transfer_summary?: TransferSummary;
  transfer_categories?: TransferCategory[];
}

export interface TransferSummary {
  category_count: number;
  download: TransferAggregate;
  upload: TransferAggregate;
  download_series?: number[];
  upload_series?: number[];
}

export interface TransferAggregate {
  status: string;
  progress: number | null;
  total_items: number;
  done_items: number;
  success_items: number;
  failed_items: number;
  total_bytes: number;
  done_bytes: number;
  speed_bps: number;
  channel_count: number;
  indeterminate_channels: number;
  excluded_channels: number;
  progress_basis: "bytes" | "items" | "reported" | "";
}

export interface TransferCategory {
  key: string;
  name: string;
  order: number;
  download?: TransferChannel;
  upload?: TransferChannel;
}

export interface TransferChannel {
  status: string;
  total_items: number | null;
  done_items: number | null;
  success_items: number | null;
  failed_items: number | null;
  total_bytes: number | null;
  done_bytes: number | null;
  speed_bps: number | null;
  progress: number | null;
  current_item: string | null;
  message: string | null;
  updated_at: string;
}

export interface IngestIntegration {
  service_key: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  token?: string;
}

export interface Stage { key: string; name: string; status: string; progress?: number; meta?: string }
export interface BatchRecord { id: number; task_id: string; range: string; total: number; success: number; failed: number; duration: string; created_at: string }
export interface ErrorSample { id: number; task_id: string; file: string; code: string; reason: string; level: string; payload: unknown; created_at: string }
export interface RecentFile { id: number; task_id: string; name: string; size: number; path: string; status: string; download_speed: number | null; upload_speed: number | null; duration: string | null; created_at: string }
export interface AccountHealth { id: number; task_id: string; side: "source" | "target"; label: string; account: string; used_bytes: number; total_bytes: number; unit: string; note: string | null; ok: boolean }

export interface Alert {
  id: number;
  service_key: string;
  task_id: string | null;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  status: "firing" | "resolved" | "muted";
  triggered_at: string;
  resolved_at: string | null;
}

export interface ServerTraffic {
  id: number;
  server_key: string;
  server_name: string;
  provider: string | null;
  region: string | null;
  interface: string;
  period: string;
  rx_bytes: number;
  tx_bytes: number;
  total_bytes: number;
  quota_bytes: number;
  usage_pct: number | null;
  source: string;
  sampled_at: string;
  updated_at: string;
  note: string | null;
}

export interface DCSpeedStat {
  dc_id: number;
  sample_count: number;
  excluded_count: number;
  failure_count: number;
  total_bytes: number;
  total_duration_ms: number;
  average_speed: number;
  median_speed: number;
  peak_speed: number;
  last_speed: number;
  last_updated_at: string;
}

export interface DCSpeedOverview {
  service_key: string;
  generated_at: string;
  retention_days: number;
  max_samples_per_dc: number;
  min_bytes: number;
  min_duration_ms: number;
  reported_at: string;
  dcs: DCSpeedStat[];
}

export interface EventRecord {
  id: number;
  service_key: string;
  task_id: string | null;
  type: "heartbeat" | "progress" | "error" | "system";
  level: string;
  message: string | null;
  stage: string | null;
  percentage: number | null;
  current: number | null;
  total: number | null;
  file_name: string | null;
  status: string | null;
  download_speed: number | null;
  upload_speed: number | null;
  raw_payload: unknown;
  created_at: string;
}

export interface Dashboard {
  total_services: number;
  healthy: number;
  running: number;
  warning: number;
  error: number;
  unknown: number;
  paused: number;
  today_alerts: number;
  firing_alerts?: number;
  today_completed_tasks: number;
  total_synced_bytes: number;
  uptime_pct: number | null;
  avg_progress_pct?: number | null;
  avg_latency_ms?: number | null;
  server_traffic_bytes?: number;
  server_traffic_quota?: number;
  server_traffic?: ServerTraffic[];
  services: Service[];
  sync_tasks: SyncTask[];
  alerts: Alert[];
  sys: Record<string, { value: number; series: number[] } | undefined>;
}
