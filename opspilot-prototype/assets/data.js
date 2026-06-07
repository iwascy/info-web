/* ============================================================
   OpsPilot · Mock data (extends design package payloads)
   ============================================================ */

const DB = {
  user: { name: 'Kane', initials: 'K', role: '本地个人版' },

  dashboard: {
    total_services: 6,
    healthy: 2,
    running: 2,
    error: 1,
    unknown: 1,
    paused: 0,
    today_alerts: 3,
    today_completed_tasks: 14,
    total_synced_bytes: 458 * 1024 * 1024 * 1024, // ~458 GB
    uptime_pct: 99.62,
    avg_latency_ms: 86,
  },

  // system resource sparklines (last ~20 ticks)
  sys: {
    cpu: { value: 23, series: [18,21,19,24,22,26,23,20,25,28,24,22,19,23,27,25,23,21,24,23] },
    mem: { value: 58, series: [52,54,55,53,56,58,60,59,57,58,61,60,58,56,57,59,58,60,58,58] },
    disk: { value: 42, series: [40,41,41,42,42,43,42,41,42,44,43,42,42,41,42,43,42,42,41,42] },
    net:  { value: 12.8, series: [8,9,11,10,12,14,13,11,12,15,13,12,10,12,14,13,12,11,13,12.8] },
  },

  services: [
    { id:'svc_001', service_key:'order-sync', name:'订单同步服务', type:'sync', status:'error',
      message:'数据库写入失败，已重试 3 次', last_heartbeat_at:'2026-06-07T21:41:02+08:00',
      last_progress_at:'2026-06-07T21:42:58+08:00', progress:68,
      heartbeat_series:[1,1,1,1,1,0,1,1,1,1,1,0,0], uptime:'13d 4h', region:'本地' },
    { id:'svc_002', service_key:'user-api', name:'用户服务 API', type:'api', status:'healthy',
      message:'running', last_heartbeat_at:'2026-06-07T21:43:02+08:00', last_progress_at:null, progress:null,
      heartbeat_series:[1,1,1,1,1,1,1,1,1,1,1,1,1], uptime:'42d 11h', qps: 312 },
    { id:'svc_003', service_key:'product-crawler', name:'商品爬虫服务', type:'crawler', status:'running',
      message:'抓取第 8 批，进度 85%', last_heartbeat_at:'2026-06-07T21:42:42+08:00',
      last_progress_at:'2026-06-07T21:42:40+08:00', progress:85,
      heartbeat_series:[1,1,1,1,1,1,1,1,1,1,1,1,1], uptime:'2d 9h' },
    { id:'svc_004', service_key:'report-generator', name:'报表生成服务', type:'script', status:'healthy',
      message:'今日报表已生成', last_heartbeat_at:'2026-06-07T21:42:12+08:00', last_progress_at:null, progress:null,
      heartbeat_series:[1,1,1,1,1,1,1,1,1,1,1,1,1], uptime:'18d 2h' },
    { id:'svc_005', service_key:'data-cleaner', name:'数据清洗服务', type:'script', status:'running',
      message:'清洗阶段，进度 34%', last_heartbeat_at:'2026-06-07T21:42:32+08:00',
      last_progress_at:'2026-06-07T21:42:30+08:00', progress:34,
      heartbeat_series:[1,1,1,1,1,1,1,1,1,1,1,1,1], uptime:'5d 7h', warn:'10 分钟无进度更新' },
    { id:'svc_006', service_key:'embedding-agent', name:'向量化 Agent', type:'agent', status:'unknown',
      message:'等待首次上报', last_heartbeat_at:null, last_progress_at:null, progress:null,
      heartbeat_series:[0,0,0,0,0,0,0,0,0,0,0,0,0], uptime:'—' },
  ],

  sync_tasks: [
    { task_id:'sync_order_001', service_key:'order-sync', task_name:'订单数据同步任务', source:'MySQL', target:'ClickHouse',
      status:'running', stage:'cleaning', total:320000000, processed:217600000, success:215800000, failed:1320000,
      skipped:480000, progress:68, speed:'12.8 MB/s', eta:'00:18:42', message:'正在清洗订单数据',
      updated_at:'2026-06-07T21:43:12+08:00', error_rate:0.61, synced:'428 MB',
      throughput:[9,11,10,12,13,12,14,13,12,15,13,12,11,12.8] },
    { task_id:'sync_user_001', service_key:'user-sync', task_name:'用户同步', source:'PostgreSQL', target:'Elasticsearch',
      status:'running', stage:'writing', total:12000000, processed:5040000, success:5039000, failed:1000, skipped:0,
      progress:42, speed:'6.3 MB/s', eta:'00:11:02', updated_at:'2026-06-07T21:43:10+08:00', error_rate:0.02, synced:'96 MB',
      throughput:[5,6,5.5,6,6.3,6.1,6.4,6.2,6,6.3,6.5,6.2,6.1,6.3] },
    { task_id:'sync_inventory_001', service_key:'inventory-sync', task_name:'库存同步', source:'SQL Server', target:'ClickHouse',
      status:'error', stage:'writing', total:9000000, processed:2070000, success:2061000, failed:9000, skipped:0,
      progress:23, speed:'1.2 MB/s', eta:null, message:'目标表写入超时，已重试 3 次', updated_at:'2026-06-07T21:42:58+08:00',
      error_rate:0.43, synced:'41 MB', throughput:[3,2.5,2,1.8,1.5,1.2,1,1.2,1.1,0.9,1.2,1.1,1,1.2] },
    { task_id:'sync_report_009', service_key:'report-generator', task_name:'日报数据归档', source:'MySQL', target:'S3',
      status:'success', stage:'verify', total:4200000, processed:4200000, success:4200000, failed:0, skipped:0,
      progress:100, speed:'—', eta:'00:00:00', message:'已完成', updated_at:'2026-06-07T20:10:00+08:00', error_rate:0, synced:'1.2 GB',
      throughput:[14,15,14,16,15,14,15,16,15,14,15,16,15,15] },
  ],

  // stages for sync detail (order-sync)
  stages: [
    { key:'connect', name:'连接源库', status:'done', duration:'0.8s' },
    { key:'extract', name:'增量抽取', status:'done', duration:'2m 14s' },
    { key:'cleaning', name:'数据清洗', status:'running', progress:68 },
    { key:'writing', name:'写入目标库', status:'pending' },
    { key:'verify', name:'数据校验', status:'pending' },
  ],

  batches: [
    { id:'b138', range:'2026-06 #138', total:2400000, success:2386000, failed:14000, duration:'3m 02s', created_at:'21:42' },
    { id:'b137', range:'2026-06 #137', total:2400000, success:2394000, failed:6000, duration:'2m 51s', created_at:'21:38' },
    { id:'b136', range:'2026-06 #136', total:2400000, success:2399000, failed:1000, duration:'2m 47s', created_at:'21:34' },
    { id:'b135', range:'2026-06 #135', total:2400000, success:2398500, failed:1500, duration:'2m 50s', created_at:'21:30' },
    { id:'b134', range:'2026-06 #134', total:2400000, success:2400000, failed:0, duration:'2m 44s', created_at:'21:26' },
  ],

  error_samples: [
    { id:'es1', item_key:'order_id=80021922', message:'ClickHouse timeout (10s)', created_at:'21:42:58', raw:{ error_code:'CH_TIMEOUT', retry_count:3, host:'ch-node-2' } },
    { id:'es2', item_key:'order_id=80021805', message:'duplicate primary key', created_at:'21:41:30', raw:{ error_code:'DUP_KEY', column:'order_id' } },
    { id:'es3', item_key:'order_id=80021744', message:'invalid amount: null', created_at:'21:40:12', raw:{ error_code:'NULL_VALUE', column:'amount' } },
  ],

  alerts: [
    { id:'alt_001', service_key:'order-sync', task_id:'sync_order_001', severity:'high', title:'数据库写入失败，已重试 3 次',
      message:'ClickHouse timeout after 10s', status:'firing', triggered_at:'2026-06-07T21:42:58+08:00', resolved_at:null },
    { id:'alt_002', service_key:'data-cleaner', severity:'medium', title:'任务 10 分钟无进度更新',
      message:'running 任务疑似卡住', status:'firing', triggered_at:'2026-06-07T21:39:10+08:00', resolved_at:null },
    { id:'alt_003', service_key:'inventory-sync', task_id:'sync_inventory_001', severity:'high', title:'目标表写入超时',
      message:'SQL Server → ClickHouse 写入超时', status:'firing', triggered_at:'2026-06-07T21:42:58+08:00', resolved_at:null },
    { id:'alt_004', service_key:'user-api', severity:'low', title:'P99 延迟升高至 240ms',
      message:'短时抖动，已自动恢复', status:'resolved', triggered_at:'2026-06-07T18:12:00+08:00', resolved_at:'2026-06-07T18:21:00+08:00' },
    { id:'alt_005', service_key:'product-crawler', severity:'medium', title:'目标站点返回 429',
      message:'触发限流，已降速重试', status:'resolved', triggered_at:'2026-06-07T16:40:00+08:00', resolved_at:'2026-06-07T16:52:00+08:00' },
  ],

  events: [
    { id:'evt_001', service_key:'order-sync', type:'progress', status:'error', message:'写入 ClickHouse 失败，重试第 3 次',
      created_at:'2026-06-07T21:42:58+08:00', raw_payload:{ error_code:'CH_TIMEOUT', retry_count:3 } },
    { id:'evt_002', service_key:'user-api', type:'heartbeat', status:'ok', message:'running',
      created_at:'2026-06-07T21:41:02+08:00', raw_payload:{ status:'ok' } },
    { id:'evt_003', service_key:'order-sync', type:'progress', status:'running', message:'清洗阶段 62%',
      created_at:'2026-06-07T21:40:10+08:00', raw_payload:{ stage:'cleaning', progress:62 } },
    { id:'evt_004', service_key:'data-cleaner', type:'progress', status:'running', message:'清洗阶段 34%',
      created_at:'2026-06-07T21:32:30+08:00', raw_payload:{ stage:'cleaning', progress:34 } },
    { id:'evt_005', service_key:'product-crawler', type:'progress', status:'running', message:'抓取第 8 批，进度 85%',
      created_at:'2026-06-07T21:30:40+08:00', raw_payload:{ batch:8, progress:85 } },
    { id:'evt_006', service_key:'report-generator', type:'system', status:'ok', message:'今日报表已生成',
      created_at:'2026-06-07T21:10:00+08:00', raw_payload:{ file:'report_20260607.pdf' } },
    { id:'evt_007', service_key:'user-api', type:'heartbeat', status:'ok', message:'running',
      created_at:'2026-06-07T21:09:02+08:00', raw_payload:{ status:'ok' } },
    { id:'evt_008', service_key:'inventory-sync', type:'error', status:'error', message:'目标表写入超时，已重试 3 次',
      created_at:'2026-06-07T21:08:58+08:00', raw_payload:{ error_code:'WRITE_TIMEOUT', retry_count:3 } },
  ],
};

/* ---------------- ordering helpers ---------------- */
const SERVICE_ORDER = { error:0, warning:1, running:2, unknown:3, healthy:4, paused:5 };
const SYNC_ORDER = { error:0, running:1, warning:2, success:3, paused:4 };

function sortedServices() {
  return [...DB.services].sort((a,b) => (SERVICE_ORDER[a.status]??9) - (SERVICE_ORDER[b.status]??9));
}
function sortedSyncTasks() {
  return [...DB.sync_tasks].sort((a,b) => (SYNC_ORDER[a.status]??9) - (SYNC_ORDER[b.status]??9));
}

/* ---------------- format helpers ---------------- */
const STATUS_LABEL = { healthy:'正常', running:'运行中', warning:'警告', error:'异常', unknown:'未知', paused:'暂停',
  firing:'触发中', resolved:'已恢复', muted:'已静默', success:'成功', ok:'正常' };
const STATUS_TONE = { healthy:'healthy', running:'running', warning:'warning', error:'error', unknown:'unknown', paused:'paused', success:'healthy', ok:'healthy', firing:'error', resolved:'healthy' };
const TYPE_LABEL = { sync:'同步', api:'API', crawler:'爬虫', script:'脚本', agent:'Agent', worker:'Worker' };

function statusLabel(s){ return STATUS_LABEL[s] || s; }
function statusTone(s){ return STATUS_TONE[s] || 'unknown'; }

function fmtNumber(n){
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}
function fmtCompact(n){
  if (n === null || n === undefined) return '—';
  if (n >= 1e8) return (n/1e8).toFixed(2) + '亿';
  if (n >= 1e4) return (n/1e4).toFixed(1) + '万';
  return n.toLocaleString('en-US');
}
function fmtBytes(b){
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB']; let i=0; let v=b;
  while (v >= 1024 && i < u.length-1){ v/=1024; i++; }
  return v.toFixed(v >= 100 ? 0 : 1) + ' ' + u[i];
}
function fmtRelative(iso){
  if (!iso) return '从未';
  // fixed "now" matching mock dataset time
  const now = new Date('2026-06-07T21:43:30+08:00').getTime();
  const t = new Date(iso).getTime();
  const diff = Math.round((now - t)/1000);
  if (diff < 0) return '刚刚';
  if (diff < 60) return diff + ' 秒前';
  if (diff < 3600) return Math.floor(diff/60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff/3600) + ' 小时前';
  return Math.floor(diff/86400) + ' 天前';
}
function fmtTime(iso){
  if (!iso) return '—';
  return iso.slice(11,19);
}

function badge(status, label){
  const tone = statusTone(status);
  return `<span class="badge st-${tone}"><span class="dot ${status==='running'||status==='error'?'pulse':''}"></span>${label||statusLabel(status)}</span>`;
}
function progressBar(value, tone, cls){
  const v = Math.max(0, Math.min(100, value||0));
  const animated = (tone==='blue'||tone==='cyan'||!tone) ? 'animated' : '';
  return `<div class="progress ${cls||''}"><div class="fill ${tone||''} ${animated}" style="width:${v}%"></div></div>`;
}
function getById(arr, key, val){ return arr.find(x => x[key]===val); }
