/* Deckie core: pure logic shared by the content script, service worker, options page and tests.
   No DOM and no chrome.* calls in here, so it can run under Node for unit tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeckieCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORE_KEY = 'deckie';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const num = (v, lo, hi, d) => {
    v = Number(v);
    return Number.isFinite(v) ? clamp(v, lo, hi) : d;
  };
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- icons (24x24 stroke paths) ---------- */
  const ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    forward: '<path d="M9 5l7 7-7 7"/>',
    reload: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    settings: '<path d="M5 8h9M18 8h1M5 16h1M10 16h9"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
    star: '<path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
    bookmark: '<path d="M7 4h10v16l-5-4-5 4z"/>',
    mail: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 8l8 6 8-6"/>',
    code: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    heart: '<path d="M12 19s-7-4.4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 2.5C19 14.6 12 19 12 19z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    note: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h6"/>',
    chat: '<path d="M5 6h14v10H10l-5 4z"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    cart: '<path d="M4 5h2l2 10h10l2-7H8"/><circle cx="10" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
    tabs: '<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M3.5 11h6l1.5-3"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    bolt: '<path d="M13 3L6 13h5l-1 8 7-10h-5z"/>',
  };
  const BUILTINS = {
    back: { label: 'Back', icon: 'back' },
    forward: { label: 'Forward', icon: 'forward' },
    reload: { label: 'Reload', icon: 'reload' },
    newtab: { label: 'New tab', icon: 'plus' },
    search: { label: 'Search', icon: 'search' },
    home: { label: 'Home', icon: 'home' },
    pin: { label: 'Keep open', icon: 'pin' },
    tabs: { label: 'Open tabs', icon: 'tabs' },
    fullscreen: { label: 'Toggle fullscreen', icon: 'expand' },
    settings: { label: 'Deckie settings', icon: 'settings' },
  };
  const FONT_STACKS = {
    system: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,system-ui,sans-serif',
    rounded: 'ui-rounded,"SF Pro Rounded",Nunito,"Segoe UI",system-ui,sans-serif',
    serif: 'ui-serif,"New York",Georgia,serif',
    mono: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
  };

  /* ---------- defaults, ranges, presets ---------- */
  const DEFAULT_CONTROLS = [
    { id: 'back', type: 'builtin', action: 'back', enabled: true },
    { id: 'forward', type: 'builtin', action: 'forward', enabled: true },
    { id: 'reload', type: 'builtin', action: 'reload', enabled: true },
    { id: 'newtab', type: 'builtin', action: 'newtab', enabled: true },
    { id: 'tabs', type: 'builtin', action: 'tabs', enabled: true },
    { id: 'fullscreen', type: 'builtin', action: 'fullscreen', enabled: true },
    { id: 'search', type: 'builtin', action: 'search', enabled: true },
    { id: 'home', type: 'builtin', action: 'home', enabled: false },
    { id: 'pin', type: 'builtin', action: 'pin', enabled: false },
    { id: 'settings', type: 'builtin', action: 'settings', enabled: false },
  ];

  const DEFAULTS = {
    theme: 'system',
    preset: 'glass',
    appearance: {
      bgDark: '#1c1c1e', bgLight: '#1c1c1e', bgOpacity: 62, blur: 24,
      borderDark: '#ffffff', borderLight: '#ffffff', borderOpacity: 14, borderWidth: 1,
      radius: 999, shadow: 45, accent: '#0a84ff', glow: 0,
      iconSize: 17, iconStroke: 1.8, btnSize: 32, gap: 2, padding: 5,
      fontSize: 13, fontFamily: 'system', showLabels: false, scale: 100,
      collapsedW: 44, collapsedH: 10, expandedHeight: 0, expandedMinWidth: 0,
      searchWidth: 240, hoverOpacity: 10, pressedOpacity: 18,
    },
    behavior: {
      mode: 'pill', hover: true, click: true, clickToPin: false,
      autoCollapse: true, collapseOnOutside: true, autoHide: true,
      hoverDelay: 80, collapseDelay: 700, hideDelay: 1200, activation: 48,
      expandDir: 'center', animMs: 260, animIntensity: 35, reducedMotion: 'system',
      hideInFullscreen: false, blockedSites: [],
    },
    layout: { drag: true, handle: false, snap: true, snapDist: 24, margin: 14, separators: true, tooltips: true, openCustomIn: 'same' },
    position: { xPct: 50, yPct: 0, offX: 0, offY: 0, edge: 'top' },
    controls: DEFAULT_CONTROLS,
    search: {
      engine: 'google',
      engines: [
        { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
        { id: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
        { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
        { id: 'brave', name: 'Brave', url: 'https://search.brave.com/search?q=%s' },
        { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
      ],
      homeUrl: 'https://www.google.com', newTabUrl: '', placeholder: 'Search or enter URL',
      showSuggestions: true, expandOnFocus: true, focusOnExpand: false, clearAfterSearch: true,
    },
    shortcuts: { toggle: 'Alt+Shift+D', focusSearch: 'Alt+Shift+F', toggleHidden: 'Alt+Shift+H', pin: '' },
  };

  const RANGES = {
    'appearance.bgOpacity': [0, 100], 'appearance.blur': [0, 60], 'appearance.borderOpacity': [0, 100],
    'appearance.borderWidth': [0, 4], 'appearance.radius': [0, 999], 'appearance.shadow': [0, 100],
    'appearance.glow': [0, 100], 'appearance.iconSize': [12, 28], 'appearance.iconStroke': [1, 3],
    'appearance.btnSize': [24, 52], 'appearance.gap': [0, 16], 'appearance.padding': [2, 16],
    'appearance.fontSize': [10, 18], 'appearance.scale': [70, 150], 'appearance.collapsedW': [16, 160],
    'appearance.collapsedH': [4, 32], 'appearance.expandedHeight': [0, 120], 'appearance.expandedMinWidth': [0, 900],
    'appearance.searchWidth': [120, 520], 'appearance.hoverOpacity': [0, 40], 'appearance.pressedOpacity': [0, 60],
    'behavior.hoverDelay': [0, 1500], 'behavior.collapseDelay': [0, 5000], 'behavior.hideDelay': [0, 10000],
    'behavior.activation': [8, 200], 'behavior.animMs': [0, 1000], 'behavior.animIntensity': [0, 100],
    'layout.snapDist': [0, 80], 'layout.margin': [0, 60],
    'position.xPct': [0, 100], 'position.yPct': [0, 100], 'position.offX': [-2000, 2000], 'position.offY': [-2000, 2000],
  };
  const ENUMS = {
    theme: ['system', 'dark', 'light'],
    preset: ['minimal', 'glass', 'outline', 'accent', 'adaptive', 'custom'],
    'appearance.fontFamily': Object.keys(FONT_STACKS),
    'behavior.mode': ['pill', 'hidden', 'edge'],
    'behavior.expandDir': ['center', 'left', 'right', 'up', 'down'],
    'behavior.reducedMotion': ['system', 'on', 'off'],
    'layout.openCustomIn': ['same', 'new'],
    'position.edge': ['top', 'bottom', 'left', 'right'],
  };
  const HEX = /^#[0-9a-f]{6}$/i;
  const COLOR_KEYS = ['bgDark', 'bgLight', 'borderDark', 'borderLight', 'accent'];

  const PRESETS = {
    minimal: { bgDark: '#000000', bgLight: '#000000', bgOpacity: 94, blur: 0, borderOpacity: 0, borderWidth: 0, shadow: 0, glow: 0, collapsedW: 30, collapsedH: 6 },
    glass: { bgDark: '#1c1c1e', bgLight: '#1c1c1e', bgOpacity: 62, blur: 24, borderDark: '#ffffff', borderLight: '#ffffff', borderOpacity: 14, borderWidth: 1, shadow: 45, glow: 0, collapsedW: 44, collapsedH: 10 },
    outline: { bgDark: '#111113', bgLight: '#111113', bgOpacity: 72, blur: 10, borderDark: '#ffffff', borderLight: '#ffffff', borderOpacity: 60, borderWidth: 1.5, shadow: 8, glow: 0, collapsedW: 44, collapsedH: 10 },
    accent: { bgDark: '#101216', bgLight: '#101216', bgOpacity: 70, blur: 20, borderDark: '#0a84ff', borderLight: '#0a84ff', borderOpacity: 60, borderWidth: 1, shadow: 35, glow: 55, collapsedW: 44, collapsedH: 10 },
    adaptive: { bgDark: '#1c1c1e', bgLight: '#f5f5f7', bgOpacity: 72, blur: 24, borderDark: '#ffffff', borderLight: '#000000', borderOpacity: 14, borderWidth: 1, shadow: 30, glow: 0, collapsedW: 44, collapsedH: 10 },
  };

  /* ---------- merge / sanitize ---------- */
  function merge(base, patch) {
    const out = clone(base);
    if (!isObj(patch)) return out;
    for (const k of Object.keys(out)) {
      if (!(k in patch)) continue;
      if (isObj(out[k])) out[k] = merge(out[k], patch[k]);
      else if (Array.isArray(out[k])) { if (Array.isArray(patch[k])) out[k] = clone(patch[k]); }
      else if (typeof patch[k] === typeof out[k]) out[k] = patch[k];
    }
    return out;
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; return o; };

  function sanitize(input) {
    const src = isObj(input) ? input : {};
    const s = merge(DEFAULTS, src);
    for (const [p, [lo, hi]] of Object.entries(RANGES)) setPath(s, p, num(getPath(s, p), lo, hi, getPath(DEFAULTS, p)));
    for (const [p, opts] of Object.entries(ENUMS)) if (!opts.includes(getPath(s, p))) setPath(s, p, getPath(DEFAULTS, p));
    for (const k of COLOR_KEYS) if (!HEX.test(s.appearance[k])) s.appearance[k] = DEFAULTS.appearance[k];
    s.behavior.blockedSites = (Array.isArray(s.behavior.blockedSites) ? s.behavior.blockedSites : [])
      .filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 100)).filter(Boolean).slice(0, 100);
    s.controls = sanitizeControls(src.controls);
    // search
    const engines = [];
    for (const e of s.search.engines.slice(0, 12)) {
      if (!isObj(e) || typeof e.name !== 'string' || typeof e.url !== 'string') continue;
      if (!/^https:\/\//i.test(e.url) || !e.url.includes('%s') || e.url.length > 300) continue;
      const id = /^[a-z0-9_-]{1,24}$/i.test(e.id) && !engines.some((x) => x.id === e.id) ? e.id : uid();
      engines.push({ id, name: e.name.trim().slice(0, 30) || 'Engine', url: e.url.trim() });
    }
    s.search.engines = engines.length ? engines : clone(DEFAULTS.search.engines);
    if (!s.search.engines.some((e) => e.id === s.search.engine)) s.search.engine = s.search.engines[0].id;
    s.search.homeUrl = safeNavUrl(s.search.homeUrl) || DEFAULTS.search.homeUrl;
    s.search.newTabUrl = s.search.newTabUrl ? safeNavUrl(s.search.newTabUrl) || '' : '';
    s.search.placeholder = String(s.search.placeholder).slice(0, 60);
    for (const k of Object.keys(DEFAULTS.shortcuts)) s.shortcuts[k] = normalizeCombo(s.shortcuts[k]);
    return s;
  }

  function sanitizeControls(list) {
    if (!Array.isArray(list)) return clone(DEFAULT_CONTROLS);
    const out = [], seenB = new Set(), ids = new Set();
    let customs = 0;
    const freshId = (want) => {
      let id = typeof want === 'string' && /^[a-z0-9_-]{1,24}$/i.test(want) && !ids.has(want) ? want : uid();
      while (ids.has(id)) id = uid();
      ids.add(id); return id;
    };
    for (const c of list.slice(0, 80)) {
      if (!isObj(c)) continue;
      if (c.type === 'separator') { out.push({ id: freshId(c.id), type: 'separator', enabled: true }); continue; }
      const base = {
        enabled: !!c.enabled,
        label: typeof c.label === 'string' ? c.label.trim().slice(0, 40) : '',
        tip: typeof c.tip === 'string' ? c.tip.trim().slice(0, 80) : '',
        icon: ICONS[c.icon] ? c.icon : '',
        shortcut: validateCombo(c.shortcut).ok ? normalizeCombo(c.shortcut) : '',
      };
      if (c.type === 'builtin') {
        if (!BUILTINS[c.action] || seenB.has(c.action)) continue;
        seenB.add(c.action);
        out.push({ id: freshId(c.action), type: 'builtin', action: c.action, ...base });
      } else if (c.type === 'custom') {
        if (customs >= 24) continue;
        customs++;
        out.push({ id: freshId(c.id), type: 'custom', url: safeNavUrl(c.url) || '', newTab: ['default', 'same', 'new'].includes(c.newTab) ? c.newTab : 'default', ...base, icon: base.icon || 'globe' });
      }
    }
    for (const d of DEFAULT_CONTROLS) if (!seenB.has(d.action)) out.push({ ...d, id: freshId(d.id), label: '', tip: '', icon: '', shortcut: '' });
    return out;
  }
  const controlLabel = (c) => c.label || (c.type === 'builtin' ? BUILTINS[c.action].label : hostOf(c.url) || 'Link');
  const controlIcon = (c) => c.icon || (c.type === 'builtin' ? BUILTINS[c.action].icon : 'globe');
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  function applyPreset(settings, name) {
    const s = clone(settings);
    if (PRESETS[name]) Object.assign(s.appearance, PRESETS[name]);
    s.preset = name;
    return sanitize(s);
  }

  /* ---------- URLs and search ---------- */
  function safeNavUrl(raw) {
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t || t.length > 2048) return null;
    try {
      const u = new URL(t);
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'chrome:') return u.href;
      if (t.toLowerCase() === 'about:blank') return 'about:blank';
    } catch (e) { /* not a URL */ }
    return null;
  }
  const DOMAINISH = /^(localhost|\d{1,3}(\.\d{1,3}){3}|([a-z0-9-]+\.)+[a-z]{2,}|\[[0-9a-f:]+\])(:\d+)?([/?#]\S*)?$/i;
  function resolveInput(raw, engineUrl) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    const search = () => ({ kind: 'search', url: engineUrl.replace('%s', encodeURIComponent(s)) });
    if (/\s/.test(s)) return search();
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^localhost:\d+/i.test(s) && !/^\d{1,3}(\.\d{1,3}){3}:/.test(s)) {
      const safe = safeNavUrl(s);
      return safe ? { kind: 'url', url: safe } : search();
    }
    if (DOMAINISH.test(s)) {
      const local = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[)/i.test(s);
      const safe = safeNavUrl((local ? 'http://' : 'https://') + s);
      if (safe) return { kind: 'url', url: safe };
    }
    return search();
  }
  function isBlocked(hostname, list) {
    const h = String(hostname || '').toLowerCase();
    for (let p of list || []) {
      p = String(p).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/^\*\./, '');
      if (p && (h === p || h.endsWith('.' + p))) return true;
    }
    return false;
  }

  /* ---------- keyboard shortcuts ---------- */
  const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const KEY_OK = /^([A-Z0-9]|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Space|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Slash|Backslash|Comma|Period|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Minus|Equal)$/;
  const MOD_ALIAS = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta' };
  function normalizeCombo(str) {
    if (typeof str !== 'string') return '';
    const parts = str.split('+').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return '';
    let key = parts.pop();
    if (key.length === 1) key = key.toUpperCase();
    if (!KEY_OK.test(key)) return '';
    const mods = new Set();
    for (const p of parts) { const m = MOD_ALIAS[p.toLowerCase()]; if (!m) return ''; mods.add(m); }
    return MODS.filter((m) => mods.has(m)).concat(key).join('+');
  }
  function comboFromEvent(e) {
    let key = '';
    const code = e.code || '';
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit\d$/.test(code)) key = code.slice(5);
    else key = code;
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    return normalizeCombo(parts.concat(key).join('+'));
  }
  const RESERVED = new Set();
  'T W N L R F D P S O U H J K E G A C V X Z Y Q B I M 1 2 3 4 5 6 7 8 9 0 Tab PageUp PageDown'.split(' ').forEach((k) => {
    RESERVED.add('Ctrl+' + k); RESERVED.add('Meta+' + k);
  });
  ['Ctrl+Shift+T', 'Ctrl+Shift+W', 'Ctrl+Shift+N', 'Ctrl+Shift+B', 'Ctrl+Shift+Delete', 'Meta+Shift+T', 'Meta+Shift+N', 'Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+F4', 'Alt+D', 'Alt+Home', 'Meta+Alt+ArrowLeft', 'Meta+Alt+ArrowRight']
    .forEach((c) => RESERVED.add(c));
  function validateCombo(str) {
    const n = normalizeCombo(str);
    if (!n) return { ok: false, reason: 'Not a valid shortcut' };
    if (!/(^|\+)(Ctrl|Alt|Meta)\+/.test(n)) return { ok: false, reason: 'Include Ctrl, Alt or Cmd so it never fires while you type' };
    if (RESERVED.has(n)) return { ok: false, reason: 'Chrome already uses this shortcut' };
    return { ok: true, combo: n };
  }
  function shortcutMap(s) {
    const map = {};
    const add = (combo, target) => { const n = normalizeCombo(combo); if (n && validateCombo(n).ok) (map[n] = map[n] || []).push(target); };
    for (const [k, v] of Object.entries(s.shortcuts)) add(v, { kind: 'global', name: k });
    for (const c of s.controls) if (c.shortcut) add(c.shortcut, { kind: 'control', id: c.id });
    return map;
  }
  const shortcutConflicts = (s) => Object.entries(shortcutMap(s)).filter(([, v]) => v.length > 1).map(([k]) => k);

  /* ---------- geometry ---------- */
  function metrics(s) {
    const a = s.appearance, k = a.scale / 100;
    return {
      btn: a.btnSize * k, icon: a.iconSize * k, gap: a.gap * k, pad: a.padding * k, font: a.fontSize * k,
      cw: a.collapsedW * k, ch: a.collapsedH * k, ct: Math.max(3, 4 * k), bw: a.borderWidth,
      eh: a.expandedHeight > 0 ? a.expandedHeight * k : a.btnSize * k + 2 * a.padding * k + 2 * a.borderWidth,
      minW: a.expandedMinWidth * k, searchW: a.searchWidth * k,
    };
  }
  /* sz = {cw, ch, ct, ew, eh}. Returns the pill rectangle in viewport pixels. */
  function computeRect(s, vw, vh, expanded, sz) {
    const p = s.position, m = s.layout.margin, edgeMode = s.behavior.mode === 'edge';
    let w = sz.cw, h = sz.ch, dir = s.behavior.expandDir;
    if (edgeMode) {
      const horiz = p.edge === 'top' || p.edge === 'bottom';
      w = horiz ? sz.cw : sz.ct; h = horiz ? sz.ct : sz.cw;
      dir = { top: 'down', bottom: 'up', left: 'right', right: 'left' }[p.edge];
    }
    const cx = (vw * p.xPct) / 100 + p.offX, cy = (vh * p.yPct) / 100 + p.offY;
    let x = clamp(cx - w / 2, m, vw - m - w), y = clamp(cy - h / 2, m, vh - m - h);
    if (edgeMode) {
      if (p.edge === 'top') y = 0; else if (p.edge === 'bottom') y = vh - h;
      else if (p.edge === 'left') x = 0; else x = vw - w;
    }
    const r0 = { x, y, w, h };
    if (!expanded) return r0;
    const ew = Math.min(sz.ew, Math.max(40, vw - 2 * m)), eh = Math.min(sz.eh, Math.max(20, vh - 2 * m));
    const mx = r0.x + r0.w / 2, my = r0.y + r0.h / 2;
    let ex = mx - ew / 2, ey = my - eh / 2;
    if (dir === 'right') ex = r0.x;
    else if (dir === 'left') ex = r0.x + r0.w - ew;
    else if (dir === 'down') ey = r0.y;
    else if (dir === 'up') ey = r0.y + r0.h - eh;
    return { x: clamp(ex, m, vw - m - ew), y: clamp(ey, m, vh - m - eh), w: ew, h: eh };
  }
  function snapPosition(s, vw, vh, sz) {
    const pos = { ...s.position };
    const r = computeRect(s, vw, vh, false, sz);
    const D = s.layout.snapDist + s.layout.margin;
    if (s.behavior.mode === 'edge') {
      const cx = (vw * pos.xPct) / 100 + pos.offX, cy = (vh * pos.yPct) / 100 + pos.offY;
      const d = { left: cx, right: vw - cx, top: cy, bottom: vh - cy };
      const near = Object.keys(d).sort((a, b) => d[a] - d[b])[0];
      pos.edge = near;
      if (near === 'left' || near === 'right') { pos.xPct = near === 'left' ? 0 : 100; pos.offX = 0; }
      else { pos.yPct = near === 'top' ? 0 : 100; pos.offY = 0; }
      return pos;
    }
    const d = { left: r.x, right: vw - (r.x + r.w), top: r.y, bottom: vh - (r.y + r.h) };
    if (!s.layout.snap) return pos;
    if (d.left <= D) { pos.xPct = 0; pos.offX = 0; } else if (d.right <= D) { pos.xPct = 100; pos.offX = 0; }
    if (d.top <= D) { pos.yPct = 0; pos.offY = 0; } else if (d.bottom <= D) { pos.yPct = 100; pos.offY = 0; }
    return pos;
  }
  const CORNERS = {
    'top-left': [0, 0], 'top-center': [50, 0], 'top-right': [100, 0],
    'middle-left': [0, 50], 'center': [50, 50], 'middle-right': [100, 50],
    'bottom-left': [0, 100], 'bottom-center': [50, 100], 'bottom-right': [100, 100],
  };
  function cornerPosition(s, name) {
    const c = CORNERS[name];
    return c ? { ...s.position, xPct: c[0], yPct: c[1], offX: 0, offY: 0 } : { ...s.position };
  }

  /* ---------- theme / motion ---------- */
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${Math.round(clamp(a, 0, 1) * 1000) / 1000})`; };
  const luminance = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  function isDarkTheme(s, systemDark) { return s.theme === 'dark' || (s.theme === 'system' && !!systemDark); }
  function themeVars(s, systemDark) {
    const a = s.appearance, dark = isDarkTheme(s, systemDark);
    const bg = dark ? a.bgDark : a.bgLight, bc = dark ? a.borderDark : a.borderLight;
    const fg = luminance(bg) < 0.55 ? '#f5f5f7' : '#1d1d1f';
    const sh = [];
    if (a.shadow > 0) sh.push(`0 ${Math.round(2 + a.shadow * 0.14)}px ${Math.round(6 + a.shadow * 0.5)}px rgba(0,0,0,${(a.shadow / 100 * 0.45).toFixed(3)})`);
    if (a.glow > 0) sh.push(`0 0 ${Math.round(a.glow * 0.45)}px ${rgba(a.accent, a.glow / 100 * 0.7)}`);
    const m = metrics(s);
    return {
      '--bg': rgba(bg, a.bgOpacity / 100), '--panel-bg': rgba(bg, Math.max(a.bgOpacity, 84) / 100),
      '--bc': rgba(bc, a.borderOpacity / 100), '--bw': a.borderWidth + 'px',
      '--fg': fg, '--fg2': rgba(fg, 0.62), '--line': rgba(fg, 0.16),
      '--hover': rgba(fg, a.hoverOpacity / 100), '--press': rgba(fg, a.pressedOpacity / 100),
      '--accent': a.accent, '--accent-soft': rgba(a.accent, 0.24), '--shadow': sh.join(',') || 'none',
      '--blur': a.blur + 'px', '--r': a.radius + 'px', '--btn': m.btn + 'px', '--icon': m.icon + 'px',
      '--gap': m.gap + 'px', '--pad': m.pad + 'px', '--fs': m.font + 'px', '--ff': FONT_STACKS[a.fontFamily],
    };
  }
  function motion(s, systemReduced) {
    const b = s.behavior;
    const off = b.reducedMotion === 'on' || (b.reducedMotion === 'system' && !!systemReduced);
    return { ms: off ? 0 : b.animMs, ease: `cubic-bezier(.34,${(1 + (b.animIntensity / 100) * 0.6).toFixed(2)},.64,1)` };
  }

  /* ---------- profile store ---------- */
  function defaultStore() {
    return { v: 1, activeId: 'default', order: ['default'], profiles: { default: { id: 'default', name: 'Default', settings: sanitize({}) } } };
  }
  function normalizeStore(raw) {
    if (!isObj(raw) || !isObj(raw.profiles)) return defaultStore();
    const profiles = {}, order = [];
    for (const [id, p] of Object.entries(raw.profiles).slice(0, 30)) {
      if (!isObj(p) || !/^[a-z0-9_-]{1,24}$/i.test(id)) continue;
      profiles[id] = { id, name: String(p.name || 'Profile').slice(0, 40), settings: sanitize(p.settings) };
      order.push(id);
    }
    if (!order.length) return defaultStore();
    return { v: 1, activeId: profiles[raw.activeId] ? raw.activeId : order[0], order, profiles };
  }
  const activeSettings = (store) => store.profiles[store.activeId].settings;
  function addProfile(store, name, settings) {
    const st = clone(store); let id = uid();
    while (st.profiles[id]) id = uid();
    st.profiles[id] = { id, name: String(name || 'New profile').slice(0, 40), settings: sanitize(settings || {}) };
    st.order.push(id); st.activeId = id;
    return st;
  }
  function removeProfile(store, id) {
    if (store.order.length <= 1 || !store.profiles[id]) return store;
    const st = clone(store);
    delete st.profiles[id]; st.order = st.order.filter((x) => x !== id);
    if (st.activeId === id) st.activeId = st.order[0];
    return st;
  }
  function renameProfile(store, id, name) {
    if (!store.profiles[id]) return store;
    const st = clone(store); st.profiles[id].name = String(name || '').trim().slice(0, 40) || st.profiles[id].name;
    return st;
  }
  function exportProfiles(store, ids) {
    const list = (ids || store.order).filter((i) => store.profiles[i]).map((i) => ({ name: store.profiles[i].name, settings: store.profiles[i].settings }));
    return JSON.stringify({ deckie: 1, profiles: list }, null, 2);
  }
  function importProfiles(store, text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { store, count: 0, error: 'That file is not valid JSON.' }; }
    if (!isObj(data) || data.deckie !== 1 || !Array.isArray(data.profiles)) return { store, count: 0, error: 'That file is not a Deckie export.' };
    let st = store, count = 0;
    for (const p of data.profiles.slice(0, 20)) {
      if (!isObj(p)) continue;
      st = addProfile(st, p.name || 'Imported', p.settings); count++;
    }
    return { store: st, count, error: count ? '' : 'No profiles found in that file.' };
  }

  return {
    STORE_KEY, DEFAULTS, ICONS, BUILTINS, PRESETS, FONT_STACKS, CORNERS, RANGES,
    clone, clamp, sanitize, sanitizeControls, applyPreset, merge, getPath, setPath,
    safeNavUrl, resolveInput, isBlocked, hostOf, controlLabel, controlIcon,
    normalizeCombo, comboFromEvent, validateCombo, shortcutMap, shortcutConflicts,
    metrics, computeRect, snapPosition, cornerPosition, themeVars, motion, isDarkTheme,
    defaultStore, normalizeStore, activeSettings, addProfile, removeProfile, renameProfile, exportProfiles, importProfiles,
  };
});
