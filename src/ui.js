/* Deckie toolbar UI. One class, used by the content script (mode 'page')
   and by the options page live preview (mode 'preview'). */
(function (root) {
  'use strict';
  const C = root.DeckieCore;
  const svg = (name, stroke) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${C.ICONS[name] || ''}</svg>`;

  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.root{position:absolute;inset:0;pointer-events:none;font:400 var(--fs)/1.4 var(--ff);color:var(--fg);-webkit-font-smoothing:antialiased}
.pill{position:absolute;left:0;top:0;pointer-events:auto;overflow:hidden;background:var(--bg);
  -webkit-backdrop-filter:blur(var(--blur)) saturate(170%);backdrop-filter:blur(var(--blur)) saturate(170%);
  border:var(--bw) solid var(--bc);border-radius:var(--r);box-shadow:var(--shadow);user-select:none;touch-action:none;
  transition:transform var(--ms) var(--ease),width var(--ms) var(--ease),height var(--ms) var(--ease),opacity .18s linear}
.pill[data-hidden=true]{opacity:0;pointer-events:none}
.notrans .pill,.dragging .pill{transition:none}
.dragging .pill{cursor:grabbing}
.grip{position:absolute;inset:0;transition:opacity .15s}
.grip::after{content:"";position:absolute;left:50%;top:50%;width:42%;height:2px;border-radius:2px;background:var(--fg2);opacity:.55;transform:translate(-50%,-50%)}
.root[data-edge=left] .grip::after,.root[data-edge=right] .grip::after{width:2px;height:42%}
.row{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:var(--gap);padding:0 var(--pad);
  opacity:0;transition:opacity .16s linear}
[data-state=expanded] .row{opacity:1;transition:opacity .2s linear .06s}
[data-state=expanded] .grip{opacity:0}
.btn{all:unset;box-sizing:border-box;display:inline-flex;flex:none;align-items:center;justify-content:center;gap:6px;
  height:var(--btn);min-width:var(--btn);padding:0 calc(var(--btn)*.14);border-radius:min(var(--r),calc(var(--btn)/2));
  color:var(--fg);cursor:pointer;white-space:nowrap;transition:background .12s,transform .1s,opacity .12s}
.btn svg{width:var(--icon);height:var(--icon);flex:none}
.btn:hover{background:var(--hover)}
.btn:active{background:var(--press);transform:scale(.94)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.btn[aria-disabled=true]{opacity:.38;cursor:default}
.btn[aria-pressed=true]{color:var(--accent);background:var(--accent-soft)}
.btn.nope{animation:nope .3s}
@keyframes nope{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.sep{flex:none;width:1px;height:46%;background:var(--line);margin:0 calc(var(--gap)*.5)}
.handle{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--btn)*.55);height:var(--btn);color:var(--fg2);cursor:grab}
.handle i{width:3px;height:3px;border-radius:50%;background:currentColor;box-shadow:0 -5px 0 currentColor,0 5px 0 currentColor}
.search{flex:none;display:flex;align-items:center;gap:6px;height:var(--btn);padding-left:calc(var(--btn)*.28);border-radius:min(var(--r),calc(var(--btn)/2));
  background:var(--hover);overflow:hidden;cursor:text;transition:width var(--ms) var(--ease),background .12s,box-shadow .12s}
.search svg{width:var(--icon);height:var(--icon);flex:none;color:var(--fg2)}
.search:focus-within{background:var(--press);box-shadow:inset 0 0 0 1.5px var(--accent)}
.search input{all:unset;flex:1;min-width:0;font:inherit;color:var(--fg);padding-right:calc(var(--btn)*.32);user-select:text;caret-color:var(--accent)}
.search input::placeholder{color:var(--fg2)}
.panel{position:absolute;pointer-events:auto;display:none;max-height:min(42vh,320px);overflow:auto;padding:6px;margin:0;list-style:none;
  background:var(--panel-bg);-webkit-backdrop-filter:blur(var(--blur)) saturate(170%);backdrop-filter:blur(var(--blur)) saturate(170%);
  border:var(--bw) solid var(--bc);border-radius:16px;box-shadow:var(--shadow)}
.panel[data-open=true]{display:block}
.item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;min-width:0}
.item svg{width:16px;height:16px;flex:none;color:var(--fg2)}
.item b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item small{margin-left:auto;padding-left:12px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}
.item[aria-selected=true]{background:var(--accent-soft)}
.item img{width:16px;height:16px;flex:none;border-radius:4px;object-fit:contain}
.item .x{all:unset;flex:none;margin-left:6px;width:20px;height:20px;line-height:20px;text-align:center;border-radius:6px;color:var(--fg2);cursor:pointer}
.item .x:hover{background:var(--hover);color:var(--fg)}
.item[data-cur=true] b{color:var(--accent)}
.item:focus-visible{outline:2px solid var(--accent)}
.tip{position:absolute;pointer-events:none;opacity:0;padding:5px 9px;border-radius:9px;white-space:nowrap;font-size:12px;
  background:var(--panel-bg);border:var(--bw) solid var(--bc);box-shadow:var(--shadow);transition:opacity .12s}
.tip[data-show=true]{opacity:1}
.tip kbd{font:inherit;color:var(--fg2);margin-left:8px}
`;

  const FS_BLOCK = new Set(['VIDEO', 'IFRAME', 'IMG', 'CANVAS', 'EMBED', 'OBJECT', 'AUDIO']);

  class DeckieToolbar {
    /* o: {mode:'page'|'preview', parent?, onAction(action)->Promise, onPosition(pos)} */
    constructor(o) {
      this.o = o;
      this.page = o.mode !== 'preview';
      this.s = null;
      this.expanded = false; this.pinned = false; this.userHidden = false; this.revealed = false;
      this.hover = false; this.searchActive = false; this.dragging = false; this.suppressClick = false;
      this.timers = {}; this.sugg = []; this.selIdx = 0; this.tipTimer = 0; this.layoutRaf = 0;
      this.ac = new AbortController(); this.sig = this.ac.signal;
      this.mq = window.matchMedia('(prefers-color-scheme: dark)');
      this.mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

      this.host = document.createElement('deckie-toolbar');
      const pos = this.page ? 'fixed' : 'absolute';
      this.host.style.cssText = `all:initial !important;position:${pos} !important;inset:0 !important;z-index:2147483647 !important;pointer-events:none !important;display:block !important;`;
      this.sr = this.host.attachShadow({ mode: 'open' });
      this.sr.innerHTML = `<style>${CSS}</style><div class="root"><div class="pill" role="toolbar" aria-label="Deckie"><div class="grip"></div><div class="row"></div></div><ul class="panel" role="listbox"></ul><div class="tip" role="tooltip"></div></div>`;
      this.rootEl = this.sr.querySelector('.root');
      this.pill = this.sr.querySelector('.pill');
      this.row = this.sr.querySelector('.row');
      this.panel = this.sr.querySelector('.panel');
      this.tip = this.sr.querySelector('.tip');
      (o.parent || document.documentElement).appendChild(this.host);
      this.bind();
    }

    /* ----- settings ----- */
    setSettings(s) {
      this.s = s;
      this.expanded = this.expanded && true;
      this.render();
      this.bindMove();
    }
    isDark() { return C.isDarkTheme(this.s, this.mq.matches); }

    render() {
      const s = this.s, a = s.appearance;
      this.m = C.metrics(s);
      const vars = C.themeVars(s, this.mq.matches);
      const mo = C.motion(s, this.mqReduce.matches);
      vars['--ms'] = mo.ms + 'ms'; vars['--ease'] = mo.ease;
      for (const k in vars) this.rootEl.style.setProperty(k, vars[k]);
      this.rootEl.dataset.mode = s.behavior.mode; this.rootEl.dataset.edge = s.position.edge;
      this.row.textContent = '';
      this.items = [];
      if (s.layout.handle) {
        const h = document.createElement('div'); h.className = 'handle'; h.dataset.kind = 'handle'; h.innerHTML = '<i></i>'; h.setAttribute('aria-hidden', 'true');
        this.row.appendChild(h);
      }
      let prevSep = true;
      const list = s.controls.filter((c) => c.type === 'separator' ? s.layout.separators : c.enabled);
      list.forEach((c, i) => {
        if (c.type === 'separator') {
          if (prevSep || i === list.length - 1) return;
          const d = document.createElement('div'); d.className = 'sep'; this.row.appendChild(d); prevSep = true; return;
        }
        prevSep = false;
        if (c.type === 'builtin' && c.action === 'search') { this.row.appendChild(this.buildSearch(c)); return; }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn'; b.dataset.id = c.id; b.dataset.kind = 'btn';
        const label = C.controlLabel(c);
        b.setAttribute('aria-label', label);
        b.innerHTML = svg(C.controlIcon(c), a.iconStroke);
        if (a.showLabels) { const sp = document.createElement('span'); sp.textContent = label; b.appendChild(sp); }
        if (c.type === 'builtin' && c.action === 'pin') b.setAttribute('aria-pressed', String(this.pinned));
        this.row.appendChild(b);
        this.items.push({ c, el: b });
      });
      // drop trailing separator
      const last = this.row.lastElementChild; if (last && last.classList.contains('sep')) last.remove();
      this.updateNavState();
      this.update(false);
    }

    buildSearch(c) {
      const wrap = document.createElement('div'); wrap.className = 'search'; wrap.dataset.kind = 'search';
      wrap.innerHTML = svg('search', this.s.appearance.iconStroke);
      const inp = document.createElement('input');
      inp.type = 'text'; inp.spellcheck = false; inp.autocomplete = 'off'; inp.maxLength = 2048;
      inp.placeholder = this.s.search.placeholder; inp.setAttribute('aria-label', 'Search or enter URL');
      inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false'); inp.setAttribute('aria-autocomplete', 'list');
      wrap.appendChild(inp);
      this.searchWrap = wrap; this.input = inp; this.searchItem = c;
      inp.addEventListener('focus', () => { this.searchActive = true; clearTimeout(this.timers.collapse); this.update(); this.refreshSuggestions(); });
      inp.addEventListener('blur', () => { setTimeout(() => { if (this.sr.activeElement !== inp) { this.searchActive = false; if (this.panelKind === 'search') this.closePanel(); this.update(); this.scheduleCollapse(); } }, 120); });
      inp.addEventListener('input', () => { this.update(); this.refreshSuggestions(); });
      inp.addEventListener('keydown', (e) => this.onSearchKey(e));
      wrap.addEventListener('pointerdown', (e) => { if (e.target !== inp) { e.preventDefault(); inp.focus(); } });
      return wrap;
    }
    searchTargetW() {
      const full = this.m.searchW, compact = Math.max(this.m.btn * 2.4, full * 0.78);
      if (!this.s.search.expandOnFocus) return full;
      return this.searchActive || (this.input && this.input.value) ? full : compact;
    }
    measureRow() {
      let w = 0, n = 0;
      for (const el of this.row.children) {
        n++;
        w += el.dataset.kind === 'search' ? this.searchTargetW() : el.offsetWidth;
      }
      return w + Math.max(0, n - 1) * this.m.gap + 2 * this.m.pad + 2 * this.m.bw;
    }

    /* ----- layout ----- */
    viewport() { return { w: this.host.clientWidth || 800, h: this.host.clientHeight || 600 }; }
    update(animate = true) {
      if (!this.s) return;
      const s = this.s, m = this.m, { w: vw, h: vh } = this.viewport();
      if (this.searchWrap) this.searchWrap.style.width = this.searchTargetW() + 'px';
      const ew = Math.max(m.minW, this.measureRow());
      const r = C.computeRect(s, vw, vh, this.expanded, { cw: m.cw, ch: m.ch, ct: m.ct, ew, eh: m.eh });
      this.rect = r;
      if (!animate) this.rootEl.classList.add('notrans');
      this.pill.style.width = r.w + 'px'; this.pill.style.height = r.h + 'px';
      this.pill.style.transform = `translate(${r.x}px,${r.y}px)`;
      const hidden = this.userHidden || (s.behavior.mode === 'hidden' && !this.expanded && !this.revealed) || this.fsHidden;
      this.pill.dataset.hidden = String(hidden);
      this.pill.inert = hidden;
      this.row.inert = !this.expanded;
      this.pill.dataset.state = this.rootEl.dataset.state = this.expanded ? 'expanded' : 'collapsed';
      this.pill.setAttribute('aria-expanded', String(this.expanded));
      if (!animate) { void this.pill.offsetWidth; this.rootEl.classList.remove('notrans'); }
      this.placePanel();
    }
    scheduleLayout() {
      if (this.layoutRaf) return;
      this.layoutRaf = requestAnimationFrame(() => { this.layoutRaf = 0; if (!this.dragging) this.update(false); });
    }

    /* ----- expand / collapse ----- */
    expand(opts = {}) {
      clearTimeout(this.timers.expand); clearTimeout(this.timers.hide);
      this.revealed = true;
      if (!this.expanded) { this.expanded = true; this.updateNavState(); this.update(); }
      if (opts.focus && this.s.search.focusOnExpand) this.focusSearch();
    }
    collapse(force) {
      clearTimeout(this.timers.expand); clearTimeout(this.timers.collapse);
      if (!this.expanded || (this.pinned && !force)) return;
      if (force) this.setPinned(false);
      this.expanded = false;
      if (this.input) { this.input.blur(); this.input.value = ''; }
      this.searchActive = false; this.closePanel(); this.hideTip();
      this.update();
      this.scheduleHide();
    }
    toggle() {
      if (this.expanded) { this.collapse(true); return; }
      this.expand({ focus: true });
      if (!this.searchActive) requestAnimationFrame(() => { const b = this.row.querySelector('.btn'); if (b && this.expanded) b.focus({ preventScroll: true }); });
    }
    setPinned(v) {
      this.pinned = !!v;
      const it = this.items.find((i) => i.c.action === 'pin');
      if (it) it.el.setAttribute('aria-pressed', String(this.pinned));
    }
    setUserHidden(v) { this.userHidden = !!v; if (v) this.collapse(true); this.update(); }
    scheduleCollapse() {
      clearTimeout(this.timers.collapse);
      const b = this.s.behavior;
      if (!this.expanded) { this.scheduleHide(); return; }
      if (this.pinned || !b.autoCollapse || this.searchActive || this.dragging || this.hover || this.kbFocus()) return;
      this.timers.collapse = setTimeout(() => { if (!this.hover && !this.searchActive) this.collapse(); }, b.collapseDelay);
    }
    kbFocus() { const a = this.sr.activeElement; return !!(a && a !== this.input && a.matches && a.matches(':focus-visible')); }
    scheduleHide() {
      clearTimeout(this.timers.hide);
      const b = this.s.behavior;
      if (b.mode !== 'hidden' || !b.autoHide || this.pinned || this.expanded || !this.revealed) return;
      this.timers.hide = setTimeout(() => { if (!this.hover && !this.expanded) { this.revealed = false; this.update(); } }, b.hideDelay);
    }

    /* ----- events ----- */
    bind() {
      const sig = { signal: this.sig };
      const enter = () => {
        this.hover = true; clearTimeout(this.timers.collapse); clearTimeout(this.timers.hide);
        if (!this.expanded && this.s.behavior.hover && !this.dragging) {
          clearTimeout(this.timers.expand);
          this.timers.expand = setTimeout(() => this.expand(), this.s.behavior.hoverDelay);
        }
      };
      const leave = () => { this.hover = false; clearTimeout(this.timers.expand); this.scheduleCollapse(); };
      for (const el of [this.pill, this.panel]) { el.addEventListener('pointerenter', enter, sig); el.addEventListener('pointerleave', leave, sig); }

      // click delegation
      this.pill.addEventListener('click', (e) => {
        if (this.suppressClick) { e.preventDefault(); e.stopPropagation(); this.suppressClick = false; return; }
        if (!this.expanded) {
          if (this.s.behavior.click || this.pill.dataset.hidden !== 'true') {
            this.expand({ focus: true });
            if (this.s.behavior.clickToPin) this.setPinned(true);
          }
          return;
        }
        const el = e.target.closest('.btn');
        if (!el) return;
        const it = this.items.find((i) => i.el === el);
        if (it) this.runItem(it.c, e, el);
      }, sig);
      this.pill.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return;
        const el = e.target.closest('.btn'); const it = el && this.items.find((i) => i.el === el);
        if (it && it.c.type === 'custom') { e.preventDefault(); this.runItem(it.c, e, el); }
      }, sig);
      this.pill.addEventListener('pointerover', (e) => this.onTipOver(e), sig);
      this.pill.addEventListener('pointerout', () => this.hideTip(), sig);
      this.pill.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('.btn') && e.target.matches(':focus-visible')) this.onTipOver(e); }, sig);
      this.pill.addEventListener('focusout', () => { this.hideTip(); setTimeout(() => { if (!this.kbFocus()) this.scheduleCollapse(); }, 60); }, sig);
      this.row.addEventListener('keydown', (e) => this.onRowKey(e), sig);

      // keep typing inside Deckie away from page hotkeys
      for (const t of ['keydown', 'keyup', 'keypress']) this.sr.addEventListener(t, (e) => e.stopPropagation(), sig);

      this.bindDrag(sig);
      this.panel.addEventListener('pointerdown', (e) => e.preventDefault(), sig);
      this.panel.addEventListener('click', (e) => {
        const li = e.target.closest('.item'); if (!li) return;
        const it = this.sugg[+li.dataset.i];
        if (it && it.tabId != null && e.target.closest('[data-close]')) {
          this.act({ action: 'closeTab', tabId: it.tabId });
          this.panelKind = ''; setTimeout(() => this.toggleTabs(), 120); return;
        }
        this.activateSuggestion(+li.dataset.i, e);
      }, sig);
      this.panel.addEventListener('keydown', (e) => {
        const li = e.target.closest && e.target.closest('.item');
        if (li && (e.key === 'Enter' || e.key === ' ') && e.target === li) { e.preventDefault(); this.activateSuggestion(+li.dataset.i, e); }
      }, sig);

      this.ro = new ResizeObserver(() => this.scheduleLayout());
      this.ro.observe(this.host);
      this.mq.addEventListener('change', () => this.s && this.render(), sig);
      this.mqReduce.addEventListener('change', () => this.s && this.render(), sig);

      if (this.page) {
        window.addEventListener('keydown', (e) => this.onGlobalKey(e), { ...sig, capture: true });
        document.addEventListener('pointerdown', (e) => {
          if (!this.expanded || this.pinned || !this.s.behavior.collapseOnOutside) return;
          if (e.composedPath().includes(this.host)) return;
          this.collapse();
        }, { ...sig, capture: true });
        window.addEventListener('pageshow', () => this.updateNavState(), sig);
        window.addEventListener('popstate', () => this.updateNavState(), sig);
        document.addEventListener('fullscreenchange', () => this.onFullscreen(), sig);
        this.mo = new MutationObserver(() => {
          if (!this.host.isConnected) (this.fsParent || document.documentElement).appendChild(this.host);
        });
        this.mo.observe(document.documentElement, { childList: true });
      }
    }
    bindMove() {
      if (this.moveAc) this.moveAc.abort();
      if (!this.page && !this.s) return;
      if (this.s.behavior.mode === 'pill') return;
      this.moveAc = new AbortController();
      const target = this.page ? window : this.host.parentElement || window;
      let raf = 0, ev = null;
      target.addEventListener('mousemove', (e) => {
        ev = e; if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; this.onMove(ev); });
      }, { passive: true, signal: AbortSignal.any([this.sig, this.moveAc.signal]) });
    }
    onMove(e) {
      if (this.expanded || this.dragging || this.userHidden || !this.rect) return;
      const hr = this.host.getBoundingClientRect(), r = this.rect, a = this.s.behavior.activation;
      const x = e.clientX - hr.left, y = e.clientY - hr.top;
      const near = x >= r.x - a && x <= r.x + r.w + a && y >= r.y - a && y <= r.y + r.h + a;
      if (near) {
        clearTimeout(this.timers.hide);
        if (this.s.behavior.mode === 'hidden' && !this.revealed) { this.revealed = true; this.update(); }
        if (this.s.behavior.hover && !this.timers.zone) {
          this.timers.zone = setTimeout(() => { this.timers.zone = 0; if (!this.expanded) { this.expand(); this.scheduleCollapse(); } }, this.s.behavior.hoverDelay);
        }
      } else {
        clearTimeout(this.timers.zone); this.timers.zone = 0;
        if (this.revealed && !this.hover) this.scheduleHide();
      }
    }

    bindDrag(sig) {
      let start = null;
      this.pill.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.s.layout.drag) return;
        if (e.target.closest('input')) return;
        if (this.s.layout.handle && !e.target.closest('.handle') && this.expanded) return;
        const { w, h } = this.viewport();
        start = { x: e.clientX, y: e.clientY, p: { ...this.s.position }, w, h, id: e.pointerId, moved: false };
      }, sig);
      window.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved) {
          if (Math.hypot(dx, dy) < 5) return;
          start.moved = true; this.dragging = true; this.hideTip(); this.closePanel();
          this.rootEl.classList.add('dragging');
          try { this.pill.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        const p = { ...start.p };
        p.xPct = C.clamp(start.p.xPct + (dx / start.w) * 100, 0, 100);
        p.yPct = C.clamp(start.p.yPct + (dy / start.h) * 100, 0, 100);
        this.s.position = p;
        this.update(false);
      }, sig);
      const end = (e) => {
        if (!start || e.pointerId !== start.id) return;
        const moved = start.moved; start = null;
        if (!moved) return;
        this.dragging = false; this.suppressClick = true;
        setTimeout(() => { this.suppressClick = false; }, 0);
        this.rootEl.classList.remove('dragging');
        const { w, h } = this.viewport(), m = this.m;
        this.s.position = C.snapPosition(this.s, w, h, { cw: m.cw, ch: m.ch, ct: m.ct });
        this.update();
        if (this.o.onPosition) this.o.onPosition({ ...this.s.position });
        this.scheduleCollapse();
      };
      window.addEventListener('pointerup', end, sig);
      window.addEventListener('pointercancel', end, sig);
    }

    /* ----- keyboard ----- */
    onGlobalKey(e) {
      if (!this.s || e.isComposing) return;
      const combo = C.comboFromEvent(e);
      if (!combo) return;
      const hit = C.shortcutMap(this.s)[combo];
      if (!hit) return;
      if (this.userHidden && !(hit[0].kind === 'global' && hit[0].name === 'toggleHidden')) return;
      e.preventDefault(); e.stopPropagation();
      for (const t of hit) {
        if (t.kind === 'global') this.runGlobal(t.name);
        else { const c = this.s.controls.find((x) => x.id === t.id); if (c) this.runItem(c, e, null); }
      }
    }
    runGlobal(name) {
      if (name === 'toggle') this.toggle();
      else if (name === 'toggleHidden') this.setUserHidden(!this.userHidden);
      else if (name === 'focusSearch') { this.userHidden = false; this.expand(); this.focusSearch(); }
      else if (name === 'pin') { this.expand(); this.setPinned(!this.pinned); }
    }
    focusSearch() {
      if (!this.input) return;
      this.expand();
      requestAnimationFrame(() => this.input && this.input.focus({ preventScroll: true }));
    }
    onRowKey(e) {
      if (e.target === this.input) return;
      const els = [...this.row.querySelectorAll('.btn')];
      const i = els.indexOf(e.target);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (i < 0) return;
        e.preventDefault(); els[(i + (e.key === 'ArrowRight' ? 1 : -1) + els.length) % els.length].focus();
      } else if (e.key === 'Escape') { this.collapse(true); }
    }
    onSearchKey(e) {
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        if (this.input.value || this.panel.dataset.open === 'true') { this.input.value = ''; this.closePanel(); this.update(); }
        else { this.input.blur(); if (!this.pinned) this.collapse(true); }
      } else if (k === 'ArrowDown' || k === 'ArrowUp') {
        if (!this.sugg.length) return;
        e.preventDefault();
        this.selIdx = (this.selIdx + (k === 'ArrowDown' ? 1 : -1) + this.sugg.length) % this.sugg.length;
        this.paintSelection();
      } else if (k === 'Enter') {
        e.preventDefault();
        const mod = e.ctrlKey || e.metaKey;
        if (this.sugg.length && this.selIdx >= 0) this.activateSuggestion(this.selIdx, e);
        else this.submitRaw(this.input.value, mod);
      }
    }

    /* ----- search ----- */
    engine() { const se = this.s.search; return se.engines.find((x) => x.id === se.engine) || se.engines[0]; }
    refreshSuggestions() {
      const se = this.s.search; if (!se.showSuggestions || !this.input) { this.closePanel(); return; }
      const q = this.input.value.trim(), out = [];
      const sites = this.s.controls.filter((c) => c.type === 'custom' && c.url);
      const siteItem = (c) => ({ icon: C.controlIcon(c), title: C.controlLabel(c), sub: C.hostOf(c.url), url: c.url });
      if (!q) sites.slice(0, 8).forEach((c) => out.push(siteItem(c)));
      else {
        const eng = this.engine(), r = C.resolveInput(q, eng.url);
        if (r.kind === 'url') out.push({ icon: 'globe', title: 'Go to ' + r.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), sub: 'Open', url: r.url });
        else out.push({ icon: 'search', title: q, sub: eng.name, url: r.url });
        if (r.kind === 'search') se.engines.filter((x) => x.id !== eng.id).slice(0, 2).forEach((x) => out.push({ icon: 'search', title: q, sub: x.name, url: x.url.replace('%s', encodeURIComponent(q)) }));
        const ql = q.toLowerCase();
        sites.filter((c) => C.controlLabel(c).toLowerCase().includes(ql) || c.url.toLowerCase().includes(ql)).slice(0, 4).forEach((c) => out.push(siteItem(c)));
      }
      this.panelKind = 'search';
      this.renderPanel(out, q ? 0 : -1);
    }
    renderPanel(out, sel) {
      this.sugg = out; this.selIdx = sel;
      this.panel.textContent = '';
      out.forEach((it, i) => {
        const li = document.createElement('li'); li.className = 'item'; li.dataset.i = i; li.setAttribute('role', 'option');
        if (it.cur) li.dataset.cur = 'true';
        if (it.favicon && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(it.favicon)) {
          const im = document.createElement('img'); im.alt = ''; im.src = it.favicon;
          im.addEventListener('error', () => im.replaceWith(Object.assign(document.createElement('span'), { innerHTML: svg(it.icon, 1.8) }).firstChild), { once: true });
          li.appendChild(im);
        } else li.insertAdjacentHTML('afterbegin', svg(it.icon, 1.8));
        const b = document.createElement('b'); b.textContent = it.title; li.appendChild(b);
        const sm = document.createElement('small'); sm.textContent = it.sub; li.appendChild(sm);
        if (it.tabId != null) {
          li.tabIndex = 0;
          const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.dataset.close = '1'; x.setAttribute('aria-label', 'Close tab'); x.textContent = '×'; li.appendChild(x);
        }
        this.panel.appendChild(li);
      });
      this.panel.dataset.open = String(out.length > 0);
      if (this.input) this.input.setAttribute('aria-expanded', String(out.length > 0 && this.panelKind === 'search'));
      this.paintSelection(); this.placePanel();
    }
    toggleTabs() {
      if (this.panelKind === 'tabs' && this.panel.dataset.open === 'true') { this.closePanel(); return; }
      const p = this.o.onAction && this.o.onAction({ action: 'listTabs' });
      if (!p || !p.then) return;
      p.then((r) => {
        if (!r || !r.tabs || !r.tabs.length) return;
        const out = r.tabs.map((t) => ({ icon: 'globe', title: t.title || t.host || 'Untitled', sub: t.host, tabId: t.id, cur: t.active, favicon: t.favicon }));
        this.panelKind = 'tabs'; this.renderPanel(out, out.findIndex((x) => x.cur));
      });
    }
    paintSelection() {
      [...this.panel.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === this.selIdx)));
    }
    closePanel() { this.panelKind = ''; this.sugg = []; this.panel.dataset.open = 'false'; if (this.input) this.input.setAttribute('aria-expanded', 'false'); }
    placePanel() {
      if (this.panel.dataset.open !== 'true' || !this.rect) return;
      const { w: vw, h: vh } = this.viewport(), r = this.rect;
      const w = Math.min(Math.max(r.w, 280), vw - 16);
      this.panel.style.width = w + 'px';
      this.panel.style.left = C.clamp(r.x + (r.w - w) / 2, 8, vw - 8 - w) + 'px';
      if (r.y + r.h / 2 > vh / 2) { this.panel.style.top = 'auto'; this.panel.style.bottom = vh - r.y + 8 + 'px'; }
      else { this.panel.style.bottom = 'auto'; this.panel.style.top = r.y + r.h + 8 + 'px'; }
    }
    activateSuggestion(i, e) {
      const it = this.sugg[i]; if (!it) return;
      if (it.tabId != null) { this.act({ action: 'activateTab', tabId: it.tabId }); this.closePanel(); if (!this.pinned) this.collapse(true); return; }
      this.navigate(it.url, e.ctrlKey || e.metaKey);
    }
    submitRaw(text, newTab) {
      const r = C.resolveInput(text, this.engine().url);
      if (r) this.navigate(r.url, newTab);
    }
    navigate(url, newTab) {
      this.act({ action: 'open', url, newTab: !!newTab });
      if (this.s.search.clearAfterSearch && this.input) this.input.value = '';
      this.closePanel(); this.input && this.input.blur();
      if (!this.pinned) this.collapse(true);
    }

    /* ----- actions ----- */
    act(msg, el) {
      const p = this.o.onAction ? this.o.onAction(msg) : null;
      if (el && p && p.then) p.then((r) => { if (r && r.ok === false) this.nope(el); });
    }
    nope(el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
    runItem(c, ev, el) {
      const s = this.s;
      if (c.type === 'custom') {
        if (!c.url) return;
        const mod = ev && (ev.ctrlKey || ev.metaKey || ev.button === 1);
        const newTab = mod || c.newTab === 'new' || (c.newTab === 'default' && s.layout.openCustomIn === 'new');
        this.act({ action: 'open', url: c.url, newTab, background: !!mod });
        return;
      }
      switch (c.action) {
        case 'back': case 'forward': if (el && el.getAttribute('aria-disabled') === 'true') return; this.act({ action: c.action }, el); break;
        case 'reload': this.act({ action: 'reload', bypassCache: !!(ev && ev.shiftKey) }); break;
        case 'tabs': this.toggleTabs(); break;
        case 'fullscreen': this.act({ action: 'fullscreen' }); break;
        case 'newtab': this.act({ action: 'newtab', url: s.search.newTabUrl }); break;
        case 'home': this.act({ action: 'open', url: s.search.homeUrl, newTab: !!(ev && (ev.ctrlKey || ev.metaKey)) }); break;
        case 'pin': this.setPinned(!this.pinned); break;
        case 'settings': this.act({ action: 'settings' }); break;
        case 'search': this.focusSearch(); break;
      }
    }
    updateNavState() {
      if (!this.page || !this.items) return;
      const back = this.items.find((i) => i.c.action === 'back');
      if (back) back.el.setAttribute('aria-disabled', String(history.length <= 1));
    }

    /* ----- tooltips ----- */
    onTipOver(e) {
      if (!this.s.layout.tooltips || this.dragging) return;
      const el = e.target.closest && e.target.closest('.btn');
      if (!el) return;
      const it = this.items.find((i) => i.el === el); if (!it) return;
      clearTimeout(this.tipTimer);
      this.tipTimer = setTimeout(() => this.showTip(it, el), e.type === 'focusin' ? 0 : 450);
    }
    showTip(it, el) {
      const c = it.c;
      const text = c.tip || C.controlLabel(c);
      const sc = c.shortcut || (c.action === 'pin' ? this.s.shortcuts.pin : '');
      this.tip.textContent = text;
      if (sc) { const k = document.createElement('kbd'); k.textContent = sc.replace(/\+/g, ' '); this.tip.appendChild(k); }
      const hr = this.host.getBoundingClientRect(), br = el.getBoundingClientRect(), { w: vw } = this.viewport();
      this.tip.dataset.show = 'true';
      const tw = this.tip.offsetWidth, below = this.rect.y + this.rect.h / 2 < this.viewport().h / 2;
      this.tip.style.left = C.clamp(br.left - hr.left + br.width / 2 - tw / 2, 6, vw - tw - 6) + 'px';
      this.tip.style.top = (below ? br.bottom - hr.top + 8 : br.top - hr.top - this.tip.offsetHeight - 8) + 'px';
    }
    hideTip() { clearTimeout(this.tipTimer); if (this.tip) this.tip.dataset.show = 'false'; }

    /* ----- fullscreen ----- */
    onFullscreen() {
      const el = document.fullscreenElement;
      this.fsHidden = !!el && this.s.behavior.hideInFullscreen;
      const target = el && el !== document.documentElement && !FS_BLOCK.has(el.tagName) ? el : document.documentElement;
      this.fsParent = target;
      if (this.host.parentNode !== target) target.appendChild(this.host);
      this.update(false);
    }

    /* ----- preview helpers (options page) ----- */
    setPreviewState(state) {
      if (state === 'expanded') { this.pinned = true; this.revealed = true; this.expanded = true; }
      else { this.pinned = false; this.expanded = false; this.revealed = this.s.behavior.mode !== 'hidden'; }
      this.render();
    }

    destroy() {
      this.ac.abort(); if (this.moveAc) this.moveAc.abort();
      if (this.ro) this.ro.disconnect(); if (this.mo) this.mo.disconnect();
      Object.values(this.timers).forEach(clearTimeout); clearTimeout(this.tipTimer);
      if (this.layoutRaf) cancelAnimationFrame(this.layoutRaf);
      this.host.remove();
    }
  }

  root.DeckieToolbar = DeckieToolbar;
})(typeof globalThis !== 'undefined' ? globalThis : window);
