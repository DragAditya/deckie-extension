/* Deckie settings page. Edits a draft, previews it live with the real toolbar, saves on Apply. */
(() => {
  'use strict';
  const C = globalThis.DeckieCore;
  const $ = (s) => document.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
    return e;
  };
  const icon = (name) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = C.ICONS[name] || ''; return s; };

  let store, draft, dirty = false, tab = 'appearance', toolbar, saveTimer = 0;

  const TABS = [
    ['appearance', 'Appearance'], ['behavior', 'Behavior'], ['layout', 'Layout & position'], ['controls', 'Buttons'],
    ['search', 'Search'], ['shortcuts', 'Shortcuts'], ['profiles', 'Profiles'], ['about', 'Privacy & limits'],
  ];

  /* ---------- state ---------- */
  const status = (t) => { $('#status').textContent = t; clearTimeout(saveTimer); if (t) saveTimer = setTimeout(() => { $('#status').textContent = ''; }, 2500); };
  function setDirty(v) { dirty = v; $('#apply').disabled = !v; $('#revert').disabled = !v; if (v) status('Unapplied changes'); }
  function loadDraft() { draft = C.clone(C.activeSettings(store)); $('#profileName').textContent = '· ' + store.profiles[store.activeId].name; }
  function refresh() { if (toolbar) toolbar.setSettings(C.sanitize(draft)); }
  function change(path, value, fromPreset) {
    C.setPath(draft, path, value);
    if (!fromPreset && path.startsWith('appearance.')) { draft.preset = 'custom'; const ps = $('#presetSel'); if (ps) ps.value = 'custom'; }
    draft = C.sanitize(draft); setDirty(true); refresh();
  }
  async function persist() { await chrome.storage.local.set({ [C.STORE_KEY]: store }); }
  async function apply() {
    store.profiles[store.activeId].settings = C.sanitize(draft);
    await persist(); draft = C.clone(store.profiles[store.activeId].settings); setDirty(false); status('Applied to all tabs');
  }

  /* ---------- generic controls ---------- */
  function range(label, path, min, max, step, fmt, hint) {
    const v = C.getPath(draft, path);
    const out = h('span', { class: 'val' }), inp = h('input', { type: 'range', min, max, step, value: v, 'aria-label': label });
    const show = () => { out.textContent = fmt ? fmt(+inp.value) : inp.value; };
    show();
    inp.addEventListener('input', () => { show(); change(path, +inp.value); });
    return h('div', { class: 'field' }, h('div', { class: 'row' }, h('span', { class: 'lab', text: label }), out), inp, hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  const px = (n) => n + ' px', pct = (n) => n + '%', ms = (n) => n + ' ms', auto0 = (n) => (n === 0 ? 'Auto' : n + ' px');
  function toggle(label, path, hint) {
    const inp = h('input', { type: 'checkbox' }); inp.checked = !!C.getPath(draft, path);
    inp.addEventListener('change', () => change(path, inp.checked));
    return h('div', { class: 'field' }, h('label', { class: 'switch' }, h('span', { class: 'lab', text: label }), inp), hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  function select(label, path, options, hint, onSet) {
    const sel = h('select', { 'aria-label': label }, options.map(([v, t]) => h('option', { value: v, text: t })));
    sel.value = C.getPath(draft, path);
    sel.addEventListener('change', () => { change(path, sel.value); if (onSet) onSet(); });
    return h('div', { class: 'field' }, h('span', { class: 'lab', text: label }), sel, hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  function color(label, path) {
    const inp = h('input', { type: 'color', value: C.getPath(draft, path), 'aria-label': label });
    inp.addEventListener('input', () => change(path, inp.value));
    return h('div', { class: 'field' }, h('div', { class: 'row' }, h('span', { class: 'lab', text: label }), inp));
  }
  function text(label, path, ph, hint) {
    const inp = h('input', { type: 'text', value: C.getPath(draft, path), placeholder: ph || '', 'aria-label': label, maxlength: 300 });
    inp.addEventListener('change', () => { change(path, inp.value.trim()); inp.value = C.getPath(draft, path); });
    return h('div', { class: 'field' }, h('span', { class: 'lab', text: label }), inp, hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  const grid = (...f) => h('div', { class: 'grid' }, f);
  const group = (t) => h('h3', { text: t });

  function recorder(get, set) {
    const err = h('div', { class: 'err' });
    const b = h('button', { type: 'button', class: 'rec', 'aria-label': 'Record shortcut' });
    const paint = () => { b.textContent = get() ? get().replace(/\+/g, ' + ') : 'Not set'; b.dataset.on = 'false'; };
    paint();
    b.addEventListener('click', () => {
      b.textContent = 'Press keys… (Esc to cancel, Backspace to clear)'; b.dataset.on = 'true'; err.textContent = '';
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { cleanup(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete') { set(''); cleanup(); return; }
        const combo = C.comboFromEvent(e); if (!combo) return;
        const v = C.validateCombo(combo);
        if (!v.ok) { err.textContent = v.reason; return; }
        set(v.combo); cleanup();
      };
      const cleanup = () => { window.removeEventListener('keydown', onKey, true); b.removeEventListener('blur', cleanup); paint(); };
      window.addEventListener('keydown', onKey, true); b.addEventListener('blur', cleanup);
    });
    return { b, err };
  }

  /* ---------- tabs ---------- */
  const views = {
    appearance() {
      const ps = h('select', { id: 'presetSel', 'aria-label': 'Preset' }, [['minimal', 'Minimal'], ['glass', 'Glass'], ['outline', 'Outline'], ['accent', 'Accent'], ['adaptive', 'Adaptive'], ['custom', 'Custom']].map(([v, t]) => h('option', { value: v, text: t })));
      ps.value = draft.preset;
      ps.addEventListener('change', () => {
        if (ps.value !== 'custom') { draft = C.applyPreset(draft, ps.value); setDirty(true); refresh(); render(); } else change('preset', 'custom', true);
      });
      return [
        h('h2', { text: 'Appearance' }), h('p', { class: 'muted', text: 'Pick a preset, then adjust anything. Editing a value switches the preset to Custom.' }),
        grid(h('div', { class: 'field' }, h('span', { class: 'lab', text: 'Preset' }), ps, h('span', { class: 'hint', text: 'Minimal, Glass, Outline, Accent, Adaptive or Custom.' })),
          select('Theme', 'theme', [['system', 'Match system'], ['dark', 'Dark'], ['light', 'Light']], 'Adaptive uses a different surface colour per theme.')),
        group('Surface'),
        grid(range('Background opacity', 'appearance.bgOpacity', 0, 100, 1, pct), range('Blur', 'appearance.blur', 0, 60, 1, px), range('Border opacity', 'appearance.borderOpacity', 0, 100, 1, pct),
          range('Border width', 'appearance.borderWidth', 0, 4, 0.5, px), range('Corner radius', 'appearance.radius', 0, 999, 1, px, '999 gives a full pill.'), range('Shadow', 'appearance.shadow', 0, 100, 1, pct)),
        group('Colours'),
        grid(color('Background (dark theme)', 'appearance.bgDark'), color('Background (light theme)', 'appearance.bgLight'), color('Border (dark theme)', 'appearance.borderDark'),
          color('Border (light theme)', 'appearance.borderLight'), color('Accent', 'appearance.accent'), range('Accent glow', 'appearance.glow', 0, 100, 1, pct)),
        group('Size'),
        grid(range('Overall scale', 'appearance.scale', 70, 150, 1, pct), range('Button size', 'appearance.btnSize', 24, 52, 1, px), range('Icon size', 'appearance.iconSize', 12, 28, 1, px),
          range('Icon stroke', 'appearance.iconStroke', 1, 3, 0.1, (n) => n.toFixed(1)), range('Button spacing', 'appearance.gap', 0, 16, 1, px), range('Padding', 'appearance.padding', 2, 16, 1, px)),
        group('Collapsed and expanded dimensions'),
        grid(range('Collapsed width', 'appearance.collapsedW', 16, 160, 1, px), range('Collapsed height', 'appearance.collapsedH', 4, 32, 1, px),
          range('Expanded height', 'appearance.expandedHeight', 0, 120, 1, auto0), range('Expanded minimum width', 'appearance.expandedMinWidth', 0, 900, 10, auto0),
          range('Search bar width', 'appearance.searchWidth', 120, 520, 5, px)),
        group('Type and states'),
        grid(select('Font', 'appearance.fontFamily', [['system', 'System'], ['rounded', 'Rounded'], ['serif', 'Serif'], ['mono', 'Mono']]), range('Font size', 'appearance.fontSize', 10, 18, 1, px),
          toggle('Show button labels', 'appearance.showLabels'), range('Hover highlight', 'appearance.hoverOpacity', 0, 40, 1, pct), range('Pressed highlight', 'appearance.pressedOpacity', 0, 60, 1, pct)),
      ];
    },
    behavior() {
      const blocked = h('textarea', { 'aria-label': 'Blocked sites', placeholder: 'example.com\nmail.example.org', spellcheck: 'false' });
      blocked.value = draft.behavior.blockedSites.join('\n');
      blocked.addEventListener('change', () => change('behavior.blockedSites', blocked.value.split('\n')));
      return [
        h('h2', { text: 'Behavior' }),
        grid(select('Visibility mode', 'behavior.mode', [['pill', 'Floating pill: always visible'], ['hidden', 'Fully hidden: appears near its spot'], ['edge', 'Edge dock: thin bar on a screen edge']], 'Pick the edge on the Layout tab.', () => { refresh(); }),
          select('Expansion direction', 'behavior.expandDir', [['center', 'From the centre'], ['right', 'Grow to the right'], ['left', 'Grow to the left'], ['down', 'Grow downward'], ['up', 'Grow upward']], 'Edge dock always grows away from its edge.')),
        group('Opening and closing'),
        grid(toggle('Expand on hover', 'behavior.hover'), toggle('Expand on click', 'behavior.click'), toggle('Click pins it open', 'behavior.clickToPin', 'Clicking the collapsed pill keeps it open until you unpin.'),
          toggle('Collapse automatically', 'behavior.autoCollapse'), toggle('Collapse when clicking elsewhere', 'behavior.collapseOnOutside'), toggle('Hide again when idle', 'behavior.autoHide', 'Hidden mode only.')),
        group('Timing'),
        grid(range('Hover delay', 'behavior.hoverDelay', 0, 1500, 10, ms), range('Collapse delay', 'behavior.collapseDelay', 0, 5000, 50, ms), range('Hide delay', 'behavior.hideDelay', 0, 10000, 50, ms),
          range('Activation area', 'behavior.activation', 8, 200, 1, px, 'How close the cursor must get in Hidden and Edge modes.')),
        group('Motion'),
        grid(range('Animation duration', 'behavior.animMs', 0, 1000, 10, ms), range('Animation bounce', 'behavior.animIntensity', 0, 100, 1, pct),
          select('Reduced motion', 'behavior.reducedMotion', [['system', 'Follow system'], ['on', 'Always reduce'], ['off', 'Never reduce']])),
        group('Where it shows'),
        grid(toggle('Hide in fullscreen', 'behavior.hideInFullscreen', 'Off: Deckie moves into the fullscreen page when the browser allows it.')),
        h('div', { class: 'field', style: 'margin-top:14px' }, h('span', { class: 'lab', text: 'Never show on these sites' }), blocked, h('span', { class: 'hint', text: 'One per line. A domain also covers its subdomains.' })),
      ];
    },
    layout() {
      const p = draft.position;
      const corners = h('div', { class: 'corners', role: 'group', 'aria-label': 'Position presets' }, Object.keys(C.CORNERS).map((k) => {
        const [x, y] = C.CORNERS[k];
        return h('button', { type: 'button', title: k.replace('-', ' '), 'aria-label': k.replace('-', ' '), 'aria-pressed': String(p.xPct === x && p.yPct === y && !p.offX && !p.offY),
          onclick: () => { draft.position = C.cornerPosition(C.sanitize(draft), k); draft = C.sanitize(draft); setDirty(true); refresh(); render(); } });
      }));
      return [
        h('h2', { text: 'Layout and position' }), h('p', { class: 'muted', text: 'You can also drag the toolbar in the preview above, or directly on any page.' }),
        h('div', { class: 'grid' }, h('div', { class: 'field' }, h('span', { class: 'lab', text: 'Position presets' }), corners),
          select('Dock edge', 'position.edge', [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']], 'Used by Edge dock mode. Dragging near an edge picks it for you.')),
        group('Fine position'),
        grid(range('Horizontal', 'position.xPct', 0, 100, 0.5, pct), range('Vertical', 'position.yPct', 0, 100, 0.5, pct), range('Horizontal offset', 'position.offX', -400, 400, 1, px), range('Vertical offset', 'position.offY', -400, 400, 1, px)),
        h('div', { class: 'cols' }, h('button', { class: 'btn', onclick: () => { draft.position = C.clone(C.DEFAULTS.position); setDirty(true); refresh(); render(); } }, 'Reset position'),
          h('button', { class: 'btn', onclick: () => { const keep = draft.position; draft = C.sanitize({ position: keep }); setDirty(true); refresh(); render(); } }, 'Restore default appearance and behavior')),
        group('Dragging and snapping'),
        grid(toggle('Allow dragging', 'layout.drag'), toggle('Show drag handle', 'layout.handle', 'When on, only the handle drags the open toolbar.'), toggle('Snap to edges and corners', 'layout.snap'),
          range('Snap distance', 'layout.snapDist', 0, 80, 1, px), range('Margin from the window', 'layout.margin', 0, 60, 1, px)),
        group('Details'),
        grid(toggle('Show separators', 'layout.separators'), toggle('Show tooltips', 'layout.tooltips'), select('Website buttons open', 'layout.openCustomIn', [['same', 'In the current tab'], ['new', 'In a new tab']], 'Ctrl/Cmd-click or middle-click always opens a background tab.')),
      ];
    },
    controls() {
      const list = h('div', { class: 'list' });
      const move = (i, d) => { const a = draft.controls, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setDirty(true); refresh(); render(); };
      draft.controls.forEach((c, i) => {
        const mv = h('div', { class: 'mv' }, h('button', { class: 'btn small', 'aria-label': 'Move up', onclick: () => move(i, -1) }, '↑'), h('button', { class: 'btn small', 'aria-label': 'Move down', onclick: () => move(i, 1) }, '↓'));
        if (c.type === 'separator') {
          list.append(h('div', { class: 'item sepi' }, h('span', { class: 'muted', text: '── Separator ──' }), h('div', { class: 'mv' }, mv, h('button', { class: 'btn small danger', onclick: () => { draft.controls.splice(i, 1); setDirty(true); refresh(); render(); } }, 'Remove'))));
          return;
        }
        const en = h('input', { type: 'checkbox', 'aria-label': 'Show ' + C.controlLabel(c) }); en.checked = c.enabled;
        en.addEventListener('change', () => { c.enabled = en.checked; setDirty(true); refresh(); });
        const lab = h('input', { type: 'text', value: c.label, placeholder: c.type === 'builtin' ? C.BUILTINS[c.action].label : 'Label', maxlength: 40, 'aria-label': 'Label' });
        lab.addEventListener('change', () => { c.label = lab.value.trim(); setDirty(true); refresh(); });
        const preview = icon(C.controlIcon(c));
        const isel = h('select', { 'aria-label': 'Icon' }, Object.keys(C.ICONS).map((n) => h('option', { value: n, text: n })));
        isel.value = C.controlIcon(c);
        isel.addEventListener('change', () => { c.icon = isel.value; preview.innerHTML = C.ICONS[c.icon]; setDirty(true); refresh(); });
        const rec = recorder(() => c.shortcut, (v) => { c.shortcut = v; setDirty(true); refresh(); render(); });
        const row = h('div', { class: 'item' + (c.type === 'custom' ? ' custom' : '') }, en, lab, h('div', { class: 'ico' }, preview, isel), h('div', {}, rec.b, rec.err), h('div', { class: 'mv' }, mv));
        if (c.type === 'custom') {
          const url = h('input', { type: 'url', value: c.url, placeholder: 'https://example.com', 'aria-label': 'Address' });
          url.addEventListener('change', () => { const ok = C.safeNavUrl(url.value); c.url = ok || ''; url.value = c.url; if (!ok && url.value === '') url.placeholder = 'Enter a full https:// address'; setDirty(true); refresh(); });
          const nt = h('select', { 'aria-label': 'Open in' }, [['default', 'Use default'], ['same', 'Current tab'], ['new', 'New tab']].map(([v, t]) => h('option', { value: v, text: t })));
          nt.value = c.newTab; nt.addEventListener('change', () => { c.newTab = nt.value; setDirty(true); });
          row.append(h('div', { class: 'sub' }, url, nt));
          row.lastChild.append(h('button', { class: 'btn small danger', style: 'grid-column:1/-1;justify-self:start', onclick: () => { draft.controls.splice(i, 1); setDirty(true); refresh(); render(); } }, 'Remove button'));
        }
        list.append(row);
      });
      return [
        h('h2', { text: 'Buttons' }), h('p', { class: 'muted', text: 'Turn buttons on or off, reorder them, change labels and icons, and give any of them a shortcut. The search bar sits wherever you place it in the list.' }),
        list,
        h('div', { class: 'cols' },
          h('button', { class: 'btn', onclick: () => { draft.controls.push({ id: 'c' + Math.random().toString(36).slice(2, 8), type: 'custom', enabled: true, label: 'New site', url: 'https://example.com', icon: 'globe', newTab: 'default', shortcut: '', tip: '' }); draft = C.sanitize(draft); setDirty(true); refresh(); render(); } }, 'Add website button'),
          h('button', { class: 'btn', onclick: () => { draft.controls.push({ id: 's' + Math.random().toString(36).slice(2, 8), type: 'separator', enabled: true }); setDirty(true); refresh(); render(); } }, 'Add separator')),
      ];
    },
    search() {
      const se = draft.search;
      const engList = h('div', { class: 'list' });
      se.engines.forEach((e, i) => {
        const n = h('input', { type: 'text', value: e.name, maxlength: 30, 'aria-label': 'Engine name' }), u = h('input', { type: 'text', value: e.url, 'aria-label': 'Engine URL, use %s for the query' });
        const msg = h('div', { class: 'err' });
        const upd = () => {
          if (!/^https:\/\//i.test(u.value) || !u.value.includes('%s')) { msg.textContent = 'Needs an https:// address containing %s where the query goes.'; return; }
          msg.textContent = ''; e.name = n.value.trim() || 'Engine'; e.url = u.value.trim(); setDirty(true); refresh(); const cur = $('#engineSel'); if (cur) cur.options[i].textContent = e.name;
        };
        n.addEventListener('change', upd); u.addEventListener('change', upd);
        engList.append(h('div', { class: 'item sepi', style: 'grid-template-columns:140px 1fr auto' }, n, u, se.engines.length > 1 ? h('button', { class: 'btn small danger', onclick: () => { se.engines.splice(i, 1); draft = C.sanitize(draft); setDirty(true); refresh(); render(); } }, 'Remove') : h('span')), msg);
      });
      const eng = h('select', { id: 'engineSel', 'aria-label': 'Default search engine' }, se.engines.map((e) => h('option', { value: e.id, text: e.name })));
      eng.value = se.engine; eng.addEventListener('change', () => change('search.engine', eng.value));
      return [
        h('h2', { text: 'Search' }),
        grid(h('div', { class: 'field' }, h('span', { class: 'lab', text: 'Default search engine' }), eng), text('Search box placeholder', 'search.placeholder'),
          text('Home button address', 'search.homeUrl', 'https://www.google.com'), text('New tab address', 'search.newTabUrl', 'Leave empty for Chrome’s new tab page')),
        group('Behavior'),
        grid(toggle('Show suggestions', 'search.showSuggestions', 'Suggestions come from your own website buttons and engines. Nothing is sent anywhere while you type.'),
          toggle('Widen the search bar on focus', 'search.expandOnFocus'), toggle('Focus the search bar when Deckie opens by click or shortcut', 'search.focusOnExpand'), toggle('Clear the search bar after searching', 'search.clearAfterSearch')),
        h('p', { class: 'hint', style: 'margin-top:12px', text: 'Enter opens the top result. Up and Down choose another. Ctrl or Cmd with Enter opens a new tab. Escape clears, then closes.' }),
        group('Engines'), engList,
        h('div', { class: 'cols' }, h('button', { class: 'btn', onclick: () => { se.engines.push({ id: 'e' + Math.random().toString(36).slice(2, 7), name: 'Custom', url: 'https://example.com/search?q=%s' }); setDirty(true); refresh(); render(); } }, 'Add engine')),
      ];
    },
    shortcuts() {
      const names = { toggle: ['Open or close Deckie', 'Opens the toolbar and moves focus to it.'], focusSearch: ['Focus the search bar', ''], toggleHidden: ['Show or hide Deckie', 'Hides it completely until you press it again.'], pin: ['Keep Deckie open', 'Pin or unpin.'] };
      const rows = Object.keys(names).map((k) => {
        const rec = recorder(() => draft.shortcuts[k], (v) => { draft.shortcuts[k] = v; draft = C.sanitize(draft); setDirty(true); refresh(); render(); });
        return h('tr', {}, h('td', {}, h('strong', { text: names[k][0] }), names[k][1] ? h('div', { class: 'hint', text: names[k][1] }) : null), h('td', {}, rec.b, rec.err));
      });
      const dup = C.shortcutConflicts(C.sanitize(draft));
      return [
        h('h2', { text: 'Shortcuts' }),
        h('p', { class: 'muted', text: 'Shortcuts work on any normal web page. They need Ctrl, Alt or Cmd so they never trigger while you type, and Chrome’s own shortcuts are refused.' }),
        dup.length ? h('p', { class: 'err', text: 'Used more than once: ' + dup.join(', ') + '. Both actions will run.' }) : null,
        h('table', {}, h('tbody', {}, rows)),
        h('p', { class: 'hint', style: 'margin-top:12px', text: 'Shortcuts for individual buttons are set on the Buttons tab. For a shortcut that works even when a page captures keys, bind “Show or hide the Deckie toolbar” at chrome://extensions/shortcuts.' }),
      ];
    },
    profiles() {
      const list = h('div', { class: 'list' });
      store.order.forEach((id) => {
        const p = store.profiles[id];
        const radio = h('input', { type: 'radio', name: 'prof', 'aria-label': 'Use ' + p.name }); radio.checked = id === store.activeId;
        radio.addEventListener('change', async () => { if (dirty && !confirm('Discard unapplied changes?')) { radio.checked = false; render(); return; } store.activeId = id; await persist(); loadDraft(); setDirty(false); refresh(); render(); status('Profile switched'); });
        const nm = h('input', { type: 'text', value: p.name, maxlength: 40, 'aria-label': 'Profile name' });
        nm.addEventListener('change', async () => { store = C.renameProfile(store, id, nm.value); await persist(); $('#profileName').textContent = '· ' + store.profiles[store.activeId].name; });
        list.append(h('div', { class: 'prof' }, radio, nm,
          h('button', { class: 'btn small', onclick: async () => { store = C.addProfile(store, p.name + ' copy', id === store.activeId ? C.sanitize(draft) : p.settings); await persist(); loadDraft(); setDirty(false); refresh(); render(); } }, 'Duplicate'),
          store.order.length > 1 ? h('button', { class: 'btn small danger', onclick: async () => { if (!confirm('Delete profile “' + p.name + '”?')) return; store = C.removeProfile(store, id); await persist(); loadDraft(); setDirty(false); refresh(); render(); } }, 'Delete') : h('span')));
      });
      const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files[0]; if (!f) return;
        if (f.size > 1e6) { status('File too large'); return; }
        const res = C.importProfiles(store, await f.text());
        if (res.error) { status(res.error); return; }
        store = res.store; await persist(); loadDraft(); setDirty(false); refresh(); render(); status('Imported ' + res.count + ' profile(s)');
      });
      const download = (name, txt) => { const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'application/json' })), download: name }); document.body.append(a); a.click(); a.remove(); };
      return [
        h('h2', { text: 'Profiles' }), h('p', { class: 'muted', text: 'A profile stores a full look, layout, position, buttons and behavior. The selected one is used on every page.' }),
        list,
        h('div', { class: 'cols' },
          h('button', { class: 'btn', onclick: async () => { store = C.addProfile(store, 'New profile', {}); await persist(); loadDraft(); setDirty(false); refresh(); render(); } }, 'New profile'),
          h('button', { class: 'btn', onclick: () => download('deckie-profiles.json', C.exportProfiles(store)) }, 'Export all'),
          h('button', { class: 'btn', onclick: () => file.click() }, 'Import…'), file),
      ];
    },
    about() {
      return [
        h('h2', { text: 'Privacy' }),
        h('p', { text: 'Deckie has no server, no account and no analytics. It makes no network requests of its own. Settings are kept in this browser’s extension storage. It does not read page content or your history. The tab list is only read when you press the Open tabs button.' }),
        h('table', {}, h('tbody', {},
          h('tr', {}, h('td', {}, h('code', { text: 'storage' })), h('td', { text: 'Saves your settings and profiles.' })),
          h('tr', {}, h('td', {}, h('code', { text: 'tabs' })), h('td', { text: 'Lets the Open tabs button list the titles of tabs in the current window, and switch or close them. Titles are shown, never stored or sent.' })),
          h('tr', {}, h('td', {}, h('code', { text: 'favicon' })), h('td', { text: 'Loads each tab’s icon from Chrome’s own local favicon cache for that list. No icon is fetched from the internet by Deckie.' })),
          h('tr', {}, h('td', {}, h('code', { text: 'Run on all sites' })), h('td', { text: 'Needed to show the toolbar on pages. The script only draws the toolbar; it never reads the page.' })))),
        h('h2', { style: 'margin-top:24px', text: 'Where it can’t appear' }),
        h('p', { text: 'Chrome does not let extensions draw on chrome:// pages, the New Tab page, the Chrome Web Store, view-source pages or Chrome’s PDF viewer. In element fullscreen (a video player taking over the whole screen) the toolbar can only follow along when the page’s fullscreen element can hold other elements. Native video fullscreen cannot show it. Pages that use the browser’s top layer for dialogs may draw over it.' }),
        h('p', { text: 'Back and Forward use Chrome’s tab history. Back is dimmed when the tab has no earlier page. Chrome gives extensions no way to know if Forward is possible, so Forward stays active and shakes when there is nowhere to go.' }),
        h('p', { text: 'Tabs open before Deckie was installed or updated need one reload to show it.' }),
      ];
    },
  };

  function render() {
    const panel = $('#panel');
    panel.textContent = '';
    panel.append(...views[tab]().filter(Boolean));
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === tab)));
  }

  /* ---------- boot ---------- */
  async function init() {
    const got = await chrome.storage.local.get(C.STORE_KEY);
    store = C.normalizeStore(got[C.STORE_KEY]);
    loadDraft();
    $('#tabs').append(...TABS.map(([k, t]) => h('button', { class: 'tab', 'data-t': k, role: 'tab', onclick: () => { tab = k; render(); } }, t)));
    toolbar = new globalThis.DeckieToolbar({
      mode: 'preview', parent: $('#stage'),
      onAction: (a) => { $('#stageMsg').textContent = 'Preview only. On a page this would run: ' + a.action + (a.url ? ' → ' + a.url : ''); return Promise.resolve({ ok: true }); },
      onPosition: (pos) => { draft.position = pos; setDirty(true); if (tab === 'layout') render(); },
    });
    refresh(); render();
    $('#apply').addEventListener('click', apply);
    $('#revert').addEventListener('click', () => { loadDraft(); setDirty(false); status(''); refresh(); render(); });
    const seg = (id, fn) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); });
    seg('#stateSeg', (v) => { toolbar.setSettings(C.sanitize(draft)); toolbar.setPreviewState(v); });
    seg('#bgSeg', (v) => { $('#stage').dataset.bg = v; });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch[C.STORE_KEY]) return;
      store = C.normalizeStore(ch[C.STORE_KEY].newValue);
      if (!dirty) { loadDraft(); refresh(); render(); }
    });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  init();
})();
