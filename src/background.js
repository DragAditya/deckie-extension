/* Deckie service worker. Performs the tab actions the content script asks for.
   It never reads page content, history or tab URLs. */
importScripts('core.js');
const C = globalThis.DeckieCore;

async function ensureStore() {
  const got = await chrome.storage.local.get(C.STORE_KEY);
  const store = C.normalizeStore(got[C.STORE_KEY]);
  await chrome.storage.local.set({ [C.STORE_KEY]: store });
}

chrome.runtime.onInstalled.addListener(() => { ensureStore().catch(() => {}); });
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.commands.onCommand.addListener(async (name) => {
  if (name !== 'toggle-toolbar') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'deckie:command', name: 'toggleHidden' }).catch(() => {});
});

const iconCache = new Map();
async function favicon(url) {
  let key = url;
  try { const u = new URL(url); if (u.protocol === 'http:' || u.protocol === 'https:') key = u.origin; } catch (e) { return ''; }
  if (iconCache.has(key)) return iconCache.get(key);
  let out = '';
  try {
    const r = await fetch(chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(key) + '&size=32');
    if (r.ok) {
      const b = new Uint8Array(await r.arrayBuffer());
      if (b.length && b.length < 30000) {
        let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        out = 'data:image/png;base64,' + btoa(s);
      }
    }
  } catch (e) { /* no icon */ }
  if (iconCache.size > 300) iconCache.clear();
  iconCache.set(key, out);
  return out;
}

async function handle(msg, sender) {
  const tab = sender.tab;
  if (!tab || tab.id == null) return { ok: false };
  switch (msg.action) {
    case 'back': await chrome.tabs.goBack(tab.id); return { ok: true };
    case 'forward': await chrome.tabs.goForward(tab.id); return { ok: true };
    case 'reload': await chrome.tabs.reload(tab.id, { bypassCache: !!msg.bypassCache }); return { ok: true };
    case 'newtab': {
      const url = msg.url ? C.safeNavUrl(msg.url) : null;
      await chrome.tabs.create({ ...(url ? { url } : {}), active: true, index: tab.index + 1 });
      return { ok: true };
    }
    case 'open': {
      const url = C.safeNavUrl(msg.url);
      if (!url) return { ok: false };
      if (msg.newTab) await chrome.tabs.create({ url, active: !msg.background, index: tab.index + 1 });
      else await chrome.tabs.update(tab.id, { url });
      return { ok: true };
    }
    case 'listTabs': {
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      const list = tabs.slice(0, 100);
      const icons = await Promise.all(list.map((t, i) => (i < 60 && t.url ? favicon(t.url) : '')));
      return { ok: true, tabs: list.map((t, i) => ({ id: t.id, title: String(t.title || '').slice(0, 120), host: C.hostOf(t.url || ''), active: t.id === tab.id, favicon: icons[i] })) };
    }
    case 'activateTab': case 'closeTab': {
      if (!Number.isInteger(msg.tabId)) return { ok: false };
      const t = await chrome.tabs.get(msg.tabId);
      if (t.windowId !== tab.windowId) return { ok: false };
      if (msg.action === 'activateTab') await chrome.tabs.update(t.id, { active: true });
      else await chrome.tabs.remove(t.id);
      return { ok: true };
    }
    case 'fullscreen': {
      const w = await chrome.windows.get(tab.windowId);
      await chrome.windows.update(tab.windowId, { state: w.state === 'fullscreen' ? 'normal' : 'fullscreen' });
      return { ok: true };
    }
    case 'settings': await chrome.runtime.openOptionsPage(); return { ok: true };
    default: return { ok: false };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'deckie:nav') return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false }));
  return true;
});
