/* Inline SVG icon set (Lucide-style strokes). Usage: icon('home') */
const ICONS = {
  logo: '<path d="M3 12h3l2-7 4 14 3-9 2 4h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><circle cx="7" cy="7.5" r="1" fill="currentColor"/><circle cx="7" cy="16.5" r="1" fill="currentColor"/>',
  sync: '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8.5-6M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8.5 6" stroke-linecap="round"/><path d="M21 3v6h-6M3 21v-6h6" stroke-linecap="round" stroke-linejoin="round"/>',
  alert: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01" stroke-linecap="round"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
  bug: '<path d="M8 2l1.5 2.5M16 2l-1.5 2.5"/><rect x="6" y="6" width="12" height="14" rx="6"/><path d="M12 6v14M3 11h3M3 16h3.5M18 11h3M17.5 16H21M4 7l2 2M20 7l-2 2" stroke-linecap="round"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" stroke-linecap="round"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 4h6" stroke-linecap="round"/><circle cx="9" cy="13.5" r="1.3" fill="currentColor"/><circle cx="15" cy="13.5" r="1.3" fill="currentColor"/>',
  spider: '<circle cx="12" cy="12" r="3"/><path d="M12 9V4M9 11 4 8M15 11l5-3M9 13l-5 3M15 13l5 3M12 15v5" stroke-linecap="round"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  check: '<path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M6 4l14 8-14 8z" stroke-linejoin="round"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" stroke-linejoin="round"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>',
  gauge: '<path d="M12 14l4-4" stroke-linecap="round"/><path d="M3.5 18a9 9 0 1 1 17 0" stroke-linecap="round"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 7h4v4" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronRight: '<path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke-linecap="round" stroke-linejoin="round"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z"/><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 9-9M16 6l3 3M14 8l2 2" stroke-linecap="round" stroke-linejoin="round"/>',
  filter: '<path d="M3 4h18l-7 8v6l-4 2v-8z" stroke-linejoin="round"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-linecap="round"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5z" stroke-linejoin="round"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5" stroke-linejoin="round"/>',
};

function icon(name, size) {
  const body = ICONS[name] || '';
  const s = size || 20;
  // icons use stroke by default unless they include fill
  const fillNone = ' fill="none" stroke="currentColor" stroke-width="1.9"';
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"${fillNone}>${body}</svg>`;
}

// type -> icon name
const TYPE_ICON = { sync: 'sync', api: 'globe', crawler: 'spider', script: 'file', agent: 'bot', worker: 'cpu' };
