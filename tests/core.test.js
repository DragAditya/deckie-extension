const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

const G = 'https://www.google.com/search?q=%s';

test('resolveInput: URLs, hosts and searches', () => {
  assert.deepEqual(C.resolveInput('example.com', G), { kind: 'url', url: 'https://example.com/' });
  assert.equal(C.resolveInput('localhost:3000/x', G).url, 'http://localhost:3000/x');
  assert.equal(C.resolveInput('192.168.1.1', G).url, 'http://192.168.1.1/');
  assert.equal(C.resolveInput('https://a.dev/p?q=1', G).kind, 'url');
  assert.equal(C.resolveInput('best pizza near me', G).url, 'https://www.google.com/search?q=best%20pizza%20near%20me');
  assert.equal(C.resolveInput('   ', G), null);
});
test('resolveInput never produces javascript:/data: URLs', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x', 'file:///etc/passwd', 'vbscript:x']) {
    assert.equal(C.resolveInput(bad, G).kind, 'search', bad);
  }
  assert.equal(C.safeNavUrl('javascript:alert(1)'), null);
  assert.equal(C.safeNavUrl('chrome://settings'), 'chrome://settings');
  assert.equal(C.safeNavUrl('about:blank'), 'about:blank');
});
test('shortcuts: normalize, validate, conflicts', () => {
  assert.equal(C.normalizeCombo('shift+alt+d'), 'Alt+Shift+D');
  assert.equal(C.normalizeCombo('Cmd+K'), 'Meta+K');
  assert.equal(C.normalizeCombo('Alt+'), '');
  assert.equal(C.comboFromEvent({ code: 'KeyD', altKey: true, shiftKey: true }), 'Alt+Shift+D');
  assert.equal(C.comboFromEvent({ code: 'ShiftLeft', shiftKey: true }), '');
  assert.equal(C.validateCombo('D').ok, false);
  assert.equal(C.validateCombo('Shift+D').ok, false);
  assert.equal(C.validateCombo('Ctrl+T').ok, false);
  assert.equal(C.validateCombo('Alt+Shift+D').ok, true);
  const s = C.sanitize({ shortcuts: { toggle: 'Alt+X', focusSearch: 'Alt+X' } });
  assert.deepEqual(C.shortcutConflicts(s), ['Alt+X']);
});
test('sanitize clamps ranges, rejects bad colors/enums, keeps builtin controls', () => {
  const s = C.sanitize({ appearance: { blur: 9999, bgDark: 'red', scale: -5 }, behavior: { mode: 'nope' }, controls: 'x', theme: 'neon' });
  assert.equal(s.appearance.blur, 60);
  assert.equal(s.appearance.bgDark, C.DEFAULTS.appearance.bgDark);
  assert.equal(s.appearance.scale, 70);
  assert.equal(s.behavior.mode, 'pill');
  assert.equal(s.theme, 'system');
  assert.deepEqual(s.controls.filter((c) => c.enabled).map((c) => c.action), ['back', 'forward', 'reload', 'newtab', 'tabs', 'fullscreen', 'search']);
});
test('sanitize controls: drops unsafe custom urls, dedupes, re-adds missing builtins', () => {
  const s = C.sanitize({ controls: [
    { type: 'custom', id: 'a', url: 'javascript:alert(1)', enabled: true, label: 'x' },
    { type: 'custom', id: 'a', url: 'https://github.com', enabled: true, label: 'GH', icon: 'code' },
    { type: 'builtin', action: 'back', enabled: false }, { type: 'builtin', action: 'back', enabled: true },
  ] });
  const customs = s.controls.filter((c) => c.type === 'custom');
  assert.equal(customs[0].url, '');
  assert.equal(customs[1].url, 'https://github.com/');
  assert.notEqual(customs[0].id, customs[1].id);
  assert.equal(s.controls.filter((c) => c.action === 'back').length, 1);
  assert.equal(s.controls.filter((c) => c.action === 'back')[0].enabled, false);
  assert.ok(s.controls.some((c) => c.action === 'search'));
});
test('search engines must be https and contain %s', () => {
  const s = C.sanitize({ search: { engines: [{ id: 'x', name: 'Bad', url: 'http://x.com/?q=%s' }, { id: 'y', name: 'NoQ', url: 'https://x.com/' }, { id: 'ok', name: 'OK', url: 'https://x.com/?q=%s' }], engine: 'zzz' } });
  assert.deepEqual(s.search.engines.map((e) => e.id), ['ok']);
  assert.equal(s.search.engine, 'ok');
});
test('computeRect keeps the pill inside the viewport and expands per direction', () => {
  const s = C.sanitize({});
  const sz = { cw: 44, ch: 10, ct: 4, ew: 300, eh: 44 };
  let r = C.computeRect(s, 1000, 700, false, sz);
  assert.deepEqual([r.x, r.y, r.w, r.h], [478, 14, 44, 10]);
  r = C.computeRect(s, 1000, 700, true, sz);
  assert.equal(r.x + r.w / 2, 500);
  const corner = { ...s, position: { ...s.position, xPct: 100, yPct: 100 } };
  r = C.computeRect(corner, 1000, 700, true, sz);
  assert.ok(r.x + r.w <= 1000 - s.layout.margin && r.y + r.h <= 700 - s.layout.margin);
  const small = C.computeRect(s, 200, 200, true, { ...sz, ew: 900 });
  assert.ok(small.x >= 0 && small.x + small.w <= 200);
  const right = { ...s, behavior: { ...s.behavior, expandDir: 'right' }, position: { ...s.position, xPct: 10 } };
  const c0 = C.computeRect(right, 1000, 700, false, sz), c1 = C.computeRect(right, 1000, 700, true, sz);
  assert.equal(c1.x, c0.x);
});
test('edge mode docks flush to the chosen edge', () => {
  const base = C.sanitize({ behavior: { mode: 'edge' } });
  const sz = { cw: 44, ch: 10, ct: 4, ew: 300, eh: 44 };
  const bottom = { ...base, position: { ...base.position, edge: 'bottom', yPct: 100 } };
  const r = C.computeRect(bottom, 1000, 700, false, sz);
  assert.equal(r.y + r.h, 700);
  const left = { ...base, position: { ...base.position, edge: 'left', xPct: 0, yPct: 50 } };
  const l = C.computeRect(left, 1000, 700, false, sz);
  assert.equal(l.x, 0); assert.equal(l.w, 4); assert.equal(l.h, 44);
  const e = C.computeRect(left, 1000, 700, true, sz);
  assert.ok(e.x >= left.layout.margin);
});
test('snapPosition snaps near edges, and finds nearest edge in edge mode', () => {
  const s = C.sanitize({ position: { xPct: 3, yPct: 60 } });
  const sz = { cw: 44, ch: 10, ct: 4 };
  const p = C.snapPosition(s, 1000, 700, sz);
  assert.equal(p.xPct, 0);
  assert.equal(p.yPct, 60);
  const off = C.snapPosition({ ...s, layout: { ...s.layout, snap: false } }, 1000, 700, sz);
  assert.equal(off.xPct, 3);
  const e = C.sanitize({ behavior: { mode: 'edge' }, position: { xPct: 95, yPct: 40 } });
  assert.equal(C.snapPosition(e, 1000, 700, sz).edge, 'right');
});
test('presets rewrite appearance and mark preset; custom edits keep values', () => {
  const s = C.applyPreset(C.sanitize({}), 'minimal');
  assert.equal(s.preset, 'minimal'); assert.equal(s.appearance.blur, 0); assert.equal(s.appearance.bgDark, '#000000');
});
test('themeVars picks readable foreground and respects theme', () => {
  const dark = C.themeVars(C.sanitize({ theme: 'dark' }), false);
  assert.equal(dark['--fg'], '#f5f5f7');
  const ad = C.applyPreset(C.sanitize({ theme: 'system' }), 'adaptive');
  assert.equal(C.themeVars(ad, true)['--fg'], '#f5f5f7');
  assert.equal(C.themeVars(ad, false)['--fg'], '#1d1d1f');
  assert.equal(C.motion(C.sanitize({ behavior: { reducedMotion: 'on' } }), false).ms, 0);
  assert.equal(C.motion(C.sanitize({}), true).ms, 0);
});
test('blocked sites match host and subdomains', () => {
  assert.ok(C.isBlocked('mail.example.com', ['example.com']));
  assert.ok(C.isBlocked('example.com', ['*.example.com']));
  assert.ok(C.isBlocked('a.b.io', ['https://a.b.io/path']));
  assert.ok(!C.isBlocked('notexample.com', ['example.com']));
});
test('profiles: add, rename, remove, export, import', () => {
  let st = C.defaultStore();
  st = C.addProfile(st, 'Work', { appearance: { blur: 5 } });
  assert.equal(st.order.length, 2); assert.equal(C.activeSettings(st).appearance.blur, 5);
  st = C.renameProfile(st, st.activeId, 'Focus');
  assert.equal(st.profiles[st.activeId].name, 'Focus');
  const text = C.exportProfiles(st);
  const res = C.importProfiles(C.defaultStore(), text);
  assert.equal(res.count, 2); assert.equal(res.store.order.length, 3);
  assert.ok(C.importProfiles(st, '{oops').error);
  assert.ok(C.importProfiles(st, '{"a":1}').error);
  st = C.removeProfile(st, st.activeId);
  assert.equal(st.order.length, 1);
  assert.equal(C.removeProfile(st, st.activeId).order.length, 1, 'cannot delete last profile');
});
test('normalizeStore repairs junk and bad ids', () => {
  assert.equal(C.normalizeStore(null).activeId, 'default');
  const st = C.normalizeStore({ activeId: 'zz', profiles: { 'bad id!': {}, ok: { name: 'N', settings: { appearance: { blur: -4 } } } } });
  assert.deepEqual(st.order, ['ok']); assert.equal(st.activeId, 'ok'); assert.equal(st.profiles.ok.settings.appearance.blur, 0);
});
