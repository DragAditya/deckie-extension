/* Deckie content script: mounts one toolbar per top-level page and keeps it in sync with saved settings. */
(() => {
  'use strict';
  if (window.top !== window) return;
  if (!(document.documentElement instanceof HTMLElement)) return;
  if (globalThis.__deckieMounted) return;
  globalThis.__deckieMounted = true;

  const C = globalThis.DeckieCore;
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  let bar = null;
  let store = null;

  function teardown() {
    if (bar) { bar.destroy(); bar = null; }
    globalThis.__deckieMounted = false;
    try { chrome.storage.onChanged.removeListener(onStorage); chrome.runtime.onMessage.removeListener(onMessage); } catch (e) { /* context gone */ }
  }

  function apply() {
    if (!alive()) { teardown(); return; }
    const s = C.activeSettings(store);
    if (C.isBlocked(location.hostname, s.behavior.blockedSites)) {
      if (bar) { bar.destroy(); bar = null; }
      return;
    }
    if (!bar) {
      bar = new globalThis.DeckieToolbar({
        mode: 'page',
        onAction: (a) => {
          if (!alive()) { teardown(); return Promise.resolve({ ok: false }); }
          return chrome.runtime.sendMessage({ type: 'deckie:nav', ...a }).catch(() => ({ ok: false }));
        },
        onPosition: savePosition,
      });
    }
    bar.setSettings(s);
  }

  async function savePosition(pos) {
    if (!alive()) return;
    try {
      const got = await chrome.storage.local.get(C.STORE_KEY);
      const st = C.normalizeStore(got[C.STORE_KEY]);
      st.profiles[st.activeId].settings.position = pos;
      store = C.normalizeStore(st);
      await chrome.storage.local.set({ [C.STORE_KEY]: store });
    } catch (e) { /* extension reloaded */ }
  }

  function onStorage(changes, area) {
    if (area !== 'local' || !changes[C.STORE_KEY]) return;
    store = C.normalizeStore(changes[C.STORE_KEY].newValue);
    apply();
  }
  function onMessage(msg, sender) {
    if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'deckie:command' || !bar) return;
    if (msg.name === 'toggleHidden') bar.setUserHidden(!bar.userHidden);
  }

  chrome.storage.onChanged.addListener(onStorage);
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.local.get(C.STORE_KEY).then((got) => {
    store = C.normalizeStore(got[C.STORE_KEY]);
    apply();
  }).catch(() => {});
})();
