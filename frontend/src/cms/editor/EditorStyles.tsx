/**
 * Editor chrome styles, injected from inside the lazy chunk so no CSS for the
 * editor ever reaches a visitor's stylesheet.
 *
 * Values are hard-coded rather than pulled from Tailwind tokens on purpose: the
 * chrome must stay legible over any page, in light or dark mode, and must not
 * shift if the site's theme colours are edited — which is something this editor
 * can do to itself.
 */
const CSS = `
.cms-hover-outline,
.cms-selected-outline {
  position: fixed;
  z-index: 2147483000;
  pointer-events: none;
  border-radius: 6px;
  transition: top .12s cubic-bezier(.22,.61,.36,1),
              left .12s cubic-bezier(.22,.61,.36,1),
              width .12s cubic-bezier(.22,.61,.36,1),
              height .12s cubic-bezier(.22,.61,.36,1);
}

.cms-hover-outline {
  outline: 2px solid rgba(59,130,246,.85);
  outline-offset: 0;
  background: rgba(59,130,246,.06);
  animation: cms-fade-in .12s ease-out;
}

.cms-selected-outline {
  outline: 2px solid rgb(37,99,235);
  background: rgba(37,99,235,.05);
  box-shadow: 0 0 0 4px rgba(37,99,235,.12);
}

.cms-hover-badge {
  position: absolute;
  top: -22px;
  left: -2px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 7px;
  border-radius: 5px;
  background: rgb(37,99,235);
  color: #fff;
  font: 500 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .01em;
  box-shadow: 0 2px 8px rgba(0,0,0,.2);
}

/* The edit cursor is the main signal that the page is live. */
[data-cms-id] { cursor: text; }
[data-cms-id][data-cms-type="IMAGE"],
[data-cms-id][data-cms-type="ICON"],
[data-cms-id][data-cms-type="LINK"],
[data-cms-id][data-cms-type="JSON"] { cursor: pointer; }

/* Frosted chrome, used by the toolbar and every editor panel. */
.cms-glass {
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 12px 40px -8px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.06);
  color: #111;
}
/* Follows the site's own theme, not the OS preference: dark mode here is driven
   by a .dark class on <html> (App.tsx). Keying off prefers-color-scheme instead
   gave dark chrome over a light page on a dark-mode laptop.
   NOTE: no backticks in this block — it is a JS template literal. */
:root.dark .cms-glass {
  background: rgba(24,20,20,.86);
  border-color: rgba(255,255,255,.12);
  color: #f5f2ef;
}

@keyframes cms-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes cms-rise {
  from { opacity: 0; transform: translate(-50%, 12px) }
  to   { opacity: 1; transform: translate(-50%, 0) }
}

.cms-toolbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 14px;
  animation: cms-rise .22s cubic-bezier(.22,.61,.36,1);
  font: 500 13px/1.2 Inter, system-ui, sans-serif;
}

/* The element being edited. Removing the focus ring matters: the selected
   outline already marks it, and the browser default clashes with it. */
.cms-editing {
  outline: none !important;
  caret-color: rgb(37,99,235);
  border-radius: 2px;
}
.cms-editing::selection { background: rgba(37,99,235,.22) }

.cms-panel,
.cms-format-toolbar {
  position: fixed;
  z-index: 2147483200;
  border-radius: 14px;
  font: 400 13px/1.45 Inter, system-ui, sans-serif;
  animation: cms-pop .16s cubic-bezier(.22,.61,.36,1);
}

.cms-panel { display: flex; flex-direction: column; max-height: min(70vh, 620px) }

.cms-format-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px;
}

.cms-panel-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  padding: 11px 12px 9px;
  border-bottom: 1px solid rgba(128,128,128,.18);
}
.cms-panel-title { font-weight: 650; font-size: 12.5px; letter-spacing: .005em }
.cms-panel-key {
  font: 400 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  opacity: .5; margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cms-panel-body { padding: 12px; overflow-y: auto; flex: 1 }
.cms-panel-foot {
  padding: 9px 12px; border-top: 1px solid rgba(128,128,128,.18);
  display: flex; align-items: center; gap: 8px; justify-content: flex-end;
}

.cms-label {
  display: block; margin-bottom: 4px;
  font-size: 11px; font-weight: 600; letter-spacing: .02em;
  text-transform: uppercase; opacity: .55;
}
.cms-hint { font-size: 11px; opacity: .55; margin-top: 4px }

.cms-input {
  width: 100%;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid rgba(128,128,128,.32);
  background: rgba(255,255,255,.7);
  color: inherit;
  font: inherit;
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.cms-input:focus {
  border-color: rgb(37,99,235);
  box-shadow: 0 0 0 3px rgba(37,99,235,.16);
}
.cms-input[aria-invalid="true"] { border-color: rgb(239,68,68) }
:root.dark .cms-input { background: rgba(255,255,255,.06) }

.cms-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 7px;
  color: inherit; background: transparent; border: 0; cursor: pointer;
  transition: background .12s, opacity .12s;
}
.cms-icon-btn:hover:not(:disabled) { background: rgba(128,128,128,.18) }
.cms-icon-btn:disabled { opacity: .3; cursor: default }
.cms-icon-btn.cms-danger:hover:not(:disabled) { background: rgba(239,68,68,.16); color: rgb(220,38,38) }

.cms-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 11px; border-radius: 8px;
  border: 1px solid rgba(128,128,128,.32);
  background: rgba(255,255,255,.6); color: inherit;
  font: 500 12px/1 Inter, system-ui, sans-serif; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.cms-btn:hover:not(:disabled) { background: rgba(128,128,128,.14) }
.cms-btn:disabled { opacity: .5; cursor: default }
.cms-btn-block { width: 100%; margin-top: 4px }
:root.dark .cms-btn { background: rgba(255,255,255,.06) }

.cms-sep { width: 1px; height: 17px; background: currentColor; opacity: .14; margin: 0 3px }

.cms-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 9px; margin-bottom: 8px;
  border-radius: 8px; border: 1px solid rgba(128,128,128,.32);
}
.cms-search-input { flex: 1; border: 0; outline: none; background: transparent; color: inherit; font: inherit }

.cms-icon-grid {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px;
  max-height: 220px; overflow-y: auto;
}
.cms-icon-cell {
  display: flex; align-items: center; justify-content: center;
  aspect-ratio: 1; border-radius: 7px;
  border: 1px solid transparent; background: transparent; color: inherit; cursor: pointer;
  transition: background .1s, border-color .1s;
}
.cms-icon-cell:hover { background: rgba(128,128,128,.16) }
.cms-icon-cell.is-active { border-color: rgb(37,99,235); background: rgba(37,99,235,.14); color: rgb(37,99,235) }

.cms-color-swatch {
  width: 34px; height: 34px; padding: 0; border-radius: 8px;
  border: 1px solid rgba(128,128,128,.32); background: none; cursor: pointer; flex-shrink: 0;
}

.cms-drop {
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  padding: 14px; border-radius: 10px; text-align: center;
  border: 1.5px dashed rgba(128,128,128,.4);
  transition: border-color .12s, background .12s;
}
.cms-drop.is-dragging { border-color: rgb(37,99,235); background: rgba(37,99,235,.07) }
.cms-drop-preview {
  max-height: 130px; max-width: 100%; border-radius: 7px; object-fit: contain;
  background: rgba(128,128,128,.1);
}

.cms-row { border: 1px solid rgba(128,128,128,.24); border-radius: 10px; overflow: hidden }
.cms-row.is-open { border-color: rgba(37,99,235,.5) }
.cms-row-head { display: flex; align-items: center; gap: 4px; padding: 5px 6px 5px 7px }
.cms-row-toggle {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
  background: none; border: 0; color: inherit; cursor: pointer;
  font: 500 12.5px/1.4 Inter, system-ui, sans-serif; text-align: left; padding: 3px 0;
}
.cms-row-index {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  background: rgba(128,128,128,.2); font-size: 10px; font-weight: 700; opacity: .75;
}
.cms-row-body {
  display: flex; flex-direction: column; gap: 11px;
  padding: 10px 11px 12px; border-top: 1px solid rgba(128,128,128,.18);
}

/* ── Media library + crop ─────────────────────────────────────────────────── */

.cms-modal-backdrop {
  position: fixed; inset: 0; z-index: 2147483300;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(0,0,0,.45);
  backdrop-filter: blur(3px);
  animation: cms-fade-in .14s ease-out;
}
.cms-modal {
  display: flex; flex-direction: column;
  width: min(1040px, 100%); height: min(660px, 100%);
  border-radius: 16px; overflow: hidden;
  font: 400 13px/1.45 Inter, system-ui, sans-serif;
  animation: cms-pop .18s cubic-bezier(.22,.61,.36,1);
}
.cms-modal-narrow { width: min(620px, 100%); height: auto; max-height: 100% }
.cms-modal-body { display: flex; flex: 1; min-height: 0 }

.cms-media-sidebar {
  width: 176px; flex-shrink: 0; padding: 9px;
  border-right: 1px solid rgba(128,128,128,.18);
  display: flex; flex-direction: column; gap: 1px; overflow-y: auto;
}
.cms-folder {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 7px; border: 0;
  background: transparent; color: inherit; cursor: pointer;
  font: 500 12px/1.3 Inter, system-ui, sans-serif; text-align: left;
}
.cms-folder:hover { background: rgba(128,128,128,.14) }
.cms-folder.is-active { background: rgba(37,99,235,.14); color: rgb(37,99,235) }

.cms-media-main { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 9px }
.cms-media-main.is-dragging { outline: 2px dashed rgb(37,99,235); outline-offset: -6px; border-radius: 10px }
.cms-media-toolbar { display: flex; align-items: center; gap: 7px; margin-bottom: 9px }
.cms-media-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 7px; overflow-y: auto; align-content: start; flex: 1; padding-right: 2px;
}
.cms-media-cell {
  aspect-ratio: 1; border-radius: 9px; overflow: hidden; padding: 0;
  border: 2px solid transparent; background: rgba(128,128,128,.12); cursor: pointer;
  transition: border-color .12s, transform .12s;
}
.cms-media-cell:hover { transform: translateY(-1px) }
.cms-media-cell.is-active { border-color: rgb(37,99,235) }
.cms-media-cell img { width: 100%; height: 100%; object-fit: cover; display: block }
.cms-media-empty { flex: 1; display: flex; align-items: center; justify-content: center }

.cms-media-detail {
  width: 236px; flex-shrink: 0; padding: 11px;
  border-left: 1px solid rgba(128,128,128,.18);
  display: flex; flex-direction: column; gap: 9px; overflow-y: auto;
}
.cms-media-preview {
  width: 100%; max-height: 150px; object-fit: contain;
  border-radius: 8px; background: rgba(128,128,128,.12);
}

.cms-crop-stage {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  padding: 14px; background: rgba(0,0,0,.14);
}
.cms-crop-box { position: relative; max-width: 100%; max-height: 340px; user-select: none; touch-action: none }
.cms-crop-box img { display: block; max-width: 100%; max-height: 340px; -webkit-user-drag: none }
.cms-crop-shade { position: absolute; inset: 0; background: rgba(0,0,0,.5); pointer-events: none }
.cms-crop-rect { position: absolute; outline: 1.5px solid #fff; cursor: move; box-shadow: 0 0 0 1px rgba(0,0,0,.4) }
.cms-crop-handle {
  position: absolute; width: 12px; height: 12px; border-radius: 3px;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.5);
}
.cms-crop-handle.is-nw { top: -6px; left: -6px; cursor: nwse-resize }
.cms-crop-handle.is-ne { top: -6px; right: -6px; cursor: nesw-resize }
.cms-crop-handle.is-sw { bottom: -6px; left: -6px; cursor: nesw-resize }
.cms-crop-handle.is-se { bottom: -6px; right: -6px; cursor: nwse-resize }
.cms-crop-controls { display: flex; flex-direction: column; gap: 11px; flex: 0 0 auto }

.cms-chip {
  padding: 4px 9px; border-radius: 999px;
  border: 1px solid rgba(128,128,128,.32); background: transparent; color: inherit;
  font: 500 11.5px/1 Inter, system-ui, sans-serif; cursor: pointer;
}
.cms-chip:hover { background: rgba(128,128,128,.14) }
.cms-chip.is-active { background: rgb(37,99,235); border-color: rgb(37,99,235); color: #fff }

/* ── History + diff ───────────────────────────────────────────────────────── */

.cms-modal-mid { width: min(760px, 100%); height: min(560px, 100%) }

.cms-history-list {
  width: 208px; flex-shrink: 0; overflow-y: auto;
  border-right: 1px solid rgba(128,128,128,.18);
}
.cms-history-item {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; border: 0; border-bottom: 1px solid rgba(128,128,128,.12);
  background: transparent; color: inherit; cursor: pointer;
}
.cms-history-item:hover { background: rgba(128,128,128,.1) }
.cms-history-item.is-active { background: rgba(37,99,235,.12); box-shadow: inset 2px 0 0 rgb(37,99,235) }

.cms-history-diff { flex: 1; min-width: 0; padding: 12px; overflow-y: auto }
.cms-diff {
  white-space: pre-wrap; word-break: break-word;
  font: 400 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-top: 8px;
}
.cms-diff-key { padding: 1px 5px; border-radius: 4px; font-weight: 600 }
.cms-add { background: rgba(34,197,94,.22); border-radius: 3px }
.cms-del { background: rgba(239,68,68,.22); border-radius: 3px; text-decoration: line-through }

.cms-btn-primary { background: rgb(37,99,235); border-color: rgb(37,99,235); color: #fff }
.cms-btn-primary:hover:not(:disabled) { background: rgb(29,78,216) }
.cms-btn.cms-danger:hover:not(:disabled) { background: rgba(239,68,68,.16); color: rgb(220,38,38) }

@keyframes cms-pop {
  from { opacity: 0; transform: scale(.97) translateY(-3px) }
  to   { opacity: 1; transform: scale(1) translateY(0) }
}

/* ── Phones and small tablets ─────────────────────────────────────────────────
   The editor was laid out for a mouse and a wide viewport. On a phone the
   toolbar overflowed off both edges, anchored panels rendered mostly off-screen,
   and the media/history modals tried to show three columns in 360px.

   The approach: panels and modals become full-width sheets, multi-column layouts
   stack, and the toolbar wraps and loses its non-essential readouts. Tap targets
   go up to 34px, which is the smallest that reliably works with a thumb. */
@media (max-width: 640px) {
  /* One row that scrolls sideways, never a wrapping one. Wrapping pushed the
     second row past the bottom of the screen, which hid Exit and Settings
     entirely — a scrollable row keeps every control reachable. */
  .cms-toolbar {
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    transform: none;
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: 7px 8px;
    border-radius: 12px;
  }
  .cms-toolbar::-webkit-scrollbar { display: none }
  .cms-toolbar > * { flex-shrink: 0 }
  /* Locale, editable count and their dividers are diagnostics, not controls. */
  .cms-toolbar .cms-hide-sm { display: none }
  .cms-toolbar button { min-height: 34px }

  /* With a sheet open the bar would be underneath it, so it moves to the top. */
  .cms-toolbar[data-panel-open] {
    bottom: auto;
    top: calc(8px + env(safe-area-inset-top, 0px));
  }

  /* Anchored popover becomes a bottom sheet. */
  .cms-panel.is-sheet {
    border-radius: 16px 16px 0 0;
    max-height: 68vh;
    /* Clear of the toolbar so the two never overlap. */
    margin-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .cms-panel.is-sheet .cms-panel-body { max-height: 52vh }

  /* A drag affordance, so the sheet reads as a sheet. */
  .cms-panel.is-sheet .cms-panel-head::before {
    content: '';
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 34px;
    height: 4px;
    border-radius: 2px;
    background: currentColor;
    opacity: .2;
  }
  .cms-panel.is-sheet .cms-panel-head { position: relative; padding-top: 16px }

  .cms-modal-backdrop { padding: 0 }
  .cms-modal, .cms-modal-narrow, .cms-modal-mid {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }
  /* Three-column media library and two-column history both stack. */
  .cms-modal-body { flex-direction: column; overflow-y: auto }
  .cms-media-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid rgba(128,128,128,.18);
    flex-shrink: 0;
  }
  .cms-folder { white-space: nowrap; flex-shrink: 0 }
  .cms-media-detail {
    width: 100%;
    border-left: 0;
    border-top: 1px solid rgba(128,128,128,.18);
  }
  .cms-media-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)) }
  .cms-history-list {
    width: 100%;
    max-height: 40vh;
    border-right: 0;
    border-bottom: 1px solid rgba(128,128,128,.18);
  }

  /* Formatting toolbar wraps instead of running off the edge. */
  .cms-format-toolbar {
    left: 8px !important;
    right: 8px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: calc(100vw - 16px);
  }
  .cms-icon-btn { width: 34px; height: 34px }

  .cms-icon-grid { grid-template-columns: repeat(6, 1fr); max-height: 180px }
  .cms-icon-cell { border-radius: 9px }

  /* The key badge is useful on a desktop and just noise on a 360px screen. */
  .cms-hover-badge { max-width: 60vw }
}

/* Very small phones: drop to the controls that actually change something. */
@media (max-width: 400px) {
  .cms-toolbar .cms-hide-xs { display: none }
  .cms-icon-grid { grid-template-columns: repeat(5, 1fr) }
}

@media (prefers-reduced-motion: reduce) {
  .cms-hover-outline, .cms-selected-outline { transition: none; animation: none }
  .cms-toolbar, .cms-panel, .cms-format-toolbar { animation: none }
}
`;

const EditorStyles = () => <style data-cms-chrome="">{CSS}</style>;

export default EditorStyles;
