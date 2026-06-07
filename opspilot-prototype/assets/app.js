/* ============================================================
   OpsPilot · App shell + charts + interactions
   ============================================================ */

const NAV = [
  { key:'dashboard', label:'总览',     icon:'home',     href:'dashboard.html' },
  { key:'services',  label:'服务',     icon:'server',   href:'services.html' },
  { key:'sync',      label:'同步任务', icon:'sync',     href:'sync.html' },
  { key:'alerts',    label:'告警',     icon:'alert',    href:'alerts.html', badge: true },
  { key:'logs',      label:'日志',     icon:'list',     href:'logs.html' },
  { key:'settings',  label:'设置',     icon:'settings', href:'settings.html' },
  { key:'docs',      label:'API 文档', icon:'code',     href:'api-docs.html' },
];

function renderShell({ active, title, subtitle }) {
  const firingCount = DB.alerts.filter(a => a.status==='firing').length;
  const navHtml = NAV.map(n => `
    <a class="nav-item ${n.key===active?'active':''}" href="${n.href}">
      ${icon(n.icon)}
      <span>${n.label}</span>
      ${n.badge && firingCount ? `<span class="nav-badge">${firingCount}</span>` : ''}
    </a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="bg-decor"></div>
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">${icon('logo', 24)}</div>
          <div>
            <div class="brand-name">OpsPilot</div>
            <div class="brand-sub">个人服务面板</div>
          </div>
        </div>
        <div class="nav-section">监控</div>
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar-foot">
          <div class="avatar">${DB.user.initials}</div>
          <div>
            <div class="foot-name">${DB.user.name}</div>
            <div class="foot-sub">${DB.user.role}</div>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-titles">
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ''}
          </div>
          <div class="topbar-spacer"></div>
          <div class="topbar-tools">
            <div class="refresh-group">
              <label>自动刷新</label>
              <label class="switch">
                <input type="checkbox" id="autoRefresh" checked>
                <span class="track"></span><span class="thumb"></span>
              </label>
            </div>
            <select class="select" id="refreshInterval">
              <option value="10">10 秒</option>
              <option value="30" selected>30 秒</option>
              <option value="60">60 秒</option>
              <option value="300">5 分钟</option>
            </select>
            <button class="btn btn-ghost btn-icon" id="manualRefresh" title="立即刷新">${icon('refresh',17)}</button>
            <div class="clock" id="clock">--:--:--</div>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
    <div class="toast-host" id="toastHost"></div>
    <div class="modal-host" id="modalHost">
      <div class="modal-backdrop" data-close></div>
      <div class="modal" id="modalBox"></div>
    </div>
  `);

  startClock();
  wireRefresh();
}

/* ---------------- clock + refresh ---------------- */
function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    el.textContent = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick(); setInterval(tick, 1000);
}

let refreshTimer = null;
function wireRefresh() {
  const toggle = document.getElementById('autoRefresh');
  const interval = document.getElementById('refreshInterval');
  const manual = document.getElementById('manualRefresh');

  const doRefresh = () => {
    const ic = manual.querySelector('svg');
    ic.classList.add('spin');
    setTimeout(() => ic.classList.remove('spin'), 900);
    if (typeof window.onRefresh === 'function') window.onRefresh();
    toast('已刷新数据', 'check');
  };
  const schedule = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (toggle.checked) refreshTimer = setInterval(() => {
      const ic = manual.querySelector('svg');
      ic.classList.add('spin'); setTimeout(()=>ic.classList.remove('spin'),900);
      if (typeof window.onRefresh === 'function') window.onRefresh();
    }, parseInt(interval.value)*1000);
  };
  toggle.addEventListener('change', schedule);
  interval.addEventListener('change', schedule);
  manual.addEventListener('click', doRefresh);
  schedule();
}

/* ---------------- charts (inline SVG, no deps) ---------------- */
function sparkline(series, color, w=120, h=40, fill=true) {
  if (!series || !series.length) return '';
  const min = Math.min(...series), max = Math.max(...series);
  const range = (max - min) || 1;
  const pad = 3;
  const pts = series.map((v,i) => {
    const x = pad + (i/(series.length-1))*(w-pad*2);
    const y = h - pad - ((v-min)/range)*(h-pad*2);
    return [x, y];
  });
  const line = pts.map((p,i)=> (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const gid = 'g'+Math.random().toString(36).slice(2,8);
  const area = fill ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${line} L ${pts[pts.length-1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z" fill="url(#${gid})"/>` : '';
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${area}<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="2.6" fill="${color}"/>
  </svg>`;
}

function lineChart(series, color, w=520, h=140) {
  if (!series || !series.length) return '';
  const min = Math.min(...series, 0), max = Math.max(...series);
  const range = (max-min)||1;
  const padL=8, padR=8, padT=12, padB=18;
  const pts = series.map((v,i)=>{
    const x = padL + (i/(series.length-1))*(w-padL-padR);
    const y = (h-padB) - ((v-min)/range)*(h-padT-padB);
    return [x,y];
  });
  const line = pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const gid='lg'+Math.random().toString(36).slice(2,8);
  // gridlines
  let grid='';
  for(let g=0; g<=3; g++){ const y=padT+(g/3)*(h-padT-padB); grid+=`<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="rgba(120,150,200,0.1)" stroke-width="1"/>`; }
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${line} L ${pts[pts.length-1][0].toFixed(1)} ${h-padB} L ${pts[0][0].toFixed(1)} ${h-padB} Z" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="3.5" fill="${color}"/>
    <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="6" fill="${color}" opacity="0.25"/>
  </svg>`;
}

/* donut: segments = [{value,color,label}] */
function donut(segments, size=168, stroke=18) {
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  const r = (size-stroke)/2;
  const cx = size/2, cy = size/2;
  const circ = 2*Math.PI*r;
  let offset = 0;
  const arcs = segments.map(seg => {
    const frac = seg.value/total;
    const len = frac*circ;
    const dash = `${len} ${circ-len}`;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})" />`;
    offset += len;
    return el;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(120,150,200,0.1)" stroke-width="${stroke}"/>
    ${arcs}</svg>`;
}

/* radial gauge for single percentage */
function gauge(pct, color, size=120, stroke=12) {
  const r=(size-stroke)/2, cx=size/2, cy=size/2, circ=2*Math.PI*r;
  const len = (pct/100)*circ;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(120,150,200,0.12)" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${len} ${circ-len}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy-2}" text-anchor="middle" dominant-baseline="middle" fill="#ecf4ff" font-size="22" font-weight="700">${pct}%</text>
  </svg>`;
}

/* ---------------- toast ---------------- */
function toast(msg, ico='info') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="t-green">${icon(ico,18)}</span>${msg}`;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(10px)'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }, 2200);
}

/* ---------------- copy ---------------- */
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    toast('已复制', 'check');
    if (btn) { const o=btn.innerHTML; btn.innerHTML = icon('check',14)+'已复制'; setTimeout(()=>btn.innerHTML=o,1500); }
  }).catch(() => toast('复制失败，请手动复制', 'x'));
}

/* ---------------- modal / confirm ---------------- */
function confirmDialog({ title, body, warn, confirmText='确认', danger=true, onConfirm }) {
  const host = document.getElementById('modalHost');
  const box = document.getElementById('modalBox');
  box.innerHTML = `
    <h3>${title}</h3>
    <p>${body||''}</p>
    ${warn ? `<div class="modal-warn">⚠ ${warn}</div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>取消</button>
      <button class="btn ${danger?'btn-danger':'btn-primary'}" id="modalConfirm">${confirmText}</button>
    </div>`;
  host.classList.add('open');
  const close = () => host.classList.remove('open');
  host.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  box.querySelector('#modalConfirm').onclick = () => { close(); onConfirm && onConfirm(); };
}
document.addEventListener('keydown', e => { if (e.key==='Escape') { const h=document.getElementById('modalHost'); h && h.classList.remove('open'); } });

/* ---------------- small builders ---------------- */
function metricCard({ label, value, note, tone='blue', ico, series }) {
  return `<div class="card metric hoverable">
    <div class="metric-top">
      <div class="metric-icon ic-${tone}">${icon(ico||'activity',23)}</div>
      <div style="flex:1">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        ${note ? `<div class="metric-note">${note}</div>` : ''}
      </div>
    </div>
    ${series ? `<div class="spark">${sparkline(series, toneColor(tone), 120, 46)}</div>` : ''}
  </div>`;
}
const TONE_COLOR = { blue:'#3785ff', cyan:'#17d5eb', green:'#29d684', yellow:'#f8b831', red:'#ff5b6f', purple:'#975cff' };
function toneColor(t){ return TONE_COLOR[t] || '#3785ff'; }

function typeTag(type){ return `<span class="tag type-${type}">${TYPE_LABEL[type]||type}</span>`; }
function cellIcon(type){
  return `<span class="cell-ico ic-${type==='sync'?'blue':type==='api'?'cyan':type==='crawler'?'purple':type==='agent'?'green':type==='script'?'yellow':'blue'}">${icon(TYPE_ICON[type]||'server',18)}</span>`;
}
