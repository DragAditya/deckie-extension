<video autoplay loop muted playsinline width="100%">
  <source src="assets/deckie-demo.mp4" type="video/mp4">
</video>

# Deckie

A tiny floating toolbar for Chrome. It sits on the page as a small pill, opens when you hover, click or press a shortcut, and gives you Back, Forward, Reload, New tab and a search bar without reaching for the browser's own toolbar. Almost everything about how it looks and behaves can be changed.

## Install

1. Unzip the folder anywhere you will keep it.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and pick the `deckie` folder (the one containing `manifest.json`).
4. Reload any tabs that were already open. Click the Deckie icon in Chrome's toolbar to open settings.

Needs Chrome 110 or newer.

## Using it

- **Open:** hover the pill, click it, or press `Alt+Shift+D`.
- **Search:** click the search bar (or `Alt+Shift+F`), type a web address or a search. Enter opens the top result, arrows pick another, `Ctrl/Cmd+Enter` opens a new tab, `Esc` clears then closes.
- **Move:** drag it anywhere. It snaps to edges and corners and remembers the spot.
- **Show or hide completely:** `Alt+Shift+H`.
- **Buttons:** Back, Forward, Reload (Shift-click bypasses the cache), New tab, Open tabs (a list to switch to or close tabs in this window), Fullscreen (toggles Chrome's fullscreen, like F11) and Search are on by default. Home, Keep open and Settings can be switched on. You can add your own website buttons (Ctrl/Cmd-click or middle-click opens a background tab).

### Visibility modes

| Mode | What you see |
|---|---|
| Floating pill | A small capsule that expands on hover. |
| Fully hidden | Nothing, until the cursor gets near its spot. |
| Edge dock | A thin bar on the edge you choose; expands on hover. |

## Settings

The settings page has a live preview that uses the real toolbar. Changes only apply to your tabs when you press **Apply changes**.

- **Appearance:** presets (Minimal, Glass, Outline, Accent, Adaptive, Custom), light/dark/system theme, colours, opacity, blur, border, radius, shadow, glow, scale, button and icon sizes, spacing, collapsed and expanded dimensions, font, labels.
- **Behavior:** visibility mode, hover/click/click-to-pin, auto-collapse, outside-click, auto-hide, all delays, activation area, expansion direction, animation length and bounce, reduced motion, hide in fullscreen, blocked sites.
- **Layout and position:** corner presets, free position and offsets, dock edge, drag handle, snapping, margins, separators, tooltips.
- **Buttons:** enable, reorder, relabel, change icons, per-button shortcuts, custom website buttons, separators.
- **Search:** default engine, custom engines (`https://…%s`), home and new-tab addresses, suggestions, focus and clearing behavior.
- **Shortcuts:** recorded in the page, validated (a modifier is required and Chrome's own shortcuts are refused).
- **Profiles:** create, rename, duplicate, delete, switch, export and import as JSON.

## Privacy and permissions

No server, no account, no analytics, no network requests of its own. Settings live in the browser's extension storage.

- `storage`: saves settings and profiles.
- `tabs`: only used when you press the Open tabs button, to list, switch and close tabs in the current window.
- `favicon`: shows each tab's icon in the Open tabs list, read from Chrome's local favicon cache.
- Runs on all pages: required to draw the toolbar. The script never reads page content or history.

Suggestions come only from your own website buttons and engine list. Nothing you type is sent anywhere until you press Enter.

## Known limits

- Chrome blocks extensions on `chrome://` pages, the New Tab page, the Web Store, `view-source:` and the built-in PDF viewer.
- Fullscreen: when a page makes a container element fullscreen, Deckie moves into it. Native video fullscreen cannot show it. Pages that use the browser top layer for modal dialogs can draw above it.
- Chrome does not tell extensions whether Forward is possible, so Forward stays active and shakes if there is nowhere to go. Back is dimmed when the tab has no earlier page.
- Typing in the search bar is kept from page hotkeys, but a page that captures keys on `window` before Deckie sees them can still react.
- Tabs open before install or update need one reload.
- Page zoom scales the toolbar with the page. Use the Overall scale setting to compensate.

## Tests

```
node --test tests/core.test.js                      # unit tests: URLs, shortcuts, geometry, sanitising, profiles
NODE_PATH=$(npm root -g) node tests/e2e.js          # loads the extension in Chromium (needs playwright)
```

The end-to-end run checks mounting, hover expand, search navigation, Back/Forward/Reload/New tab, shortcuts, dragging and position persistence, the three visibility modes, blocked sites, fullscreen, and the settings page (live preview, Apply, persistence, custom buttons, profiles).

## Layout

```
manifest.json
src/core.js        settings, profiles, URL and shortcut logic, geometry (pure, tested)
src/ui.js          the toolbar (shadow DOM), shared by pages and the settings preview
src/content.js     mounts the toolbar and syncs settings
src/background.js  tab actions (back, forward, reload, open)
options/           settings page
```
