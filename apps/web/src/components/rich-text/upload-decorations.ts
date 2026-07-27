import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

// RichTextEditor.dc.html §06 "Image states": upload runs IN PLACE — a widget
// decoration at the insert position, never a doc node. The binding spec rule
// (adjudicated) is that the document must never contain placeholder/dangling
// nodes for pending or failed uploads, so this plugin owns a DecorationSet
// keyed by upload id and mutates it via setMeta commands (add/progress/
// fail/retry/remove). DecorationSet.map() in apply() carries decoration
// positions through concurrent edits for free — typing above a pending
// upload shifts its position correctly with zero extra bookkeeping, and
// `findUploadPos` below reads the CURRENT mapped position back out.
export type UploadHandlers = {
  onRetry: (id: string, file: File) => void;
  onRemove: (id: string) => void;
};

// A ref-like box (see `uploadHandlersRef` in rich-text-editor.tsx) so the
// plugin — built once via useMemo — always calls the latest onRetry/onRemove
// closures instead of capturing stale ones from the render that created it.
export type UploadHandlersRef = { current: UploadHandlers };

type UploadEntry = {
  id: string;
  file: File;
  status: 'pending' | 'failed';
  root: HTMLDivElement;
  nameEl: HTMLSpanElement | null;
  pctEl: HTMLSpanElement | null;
  barEl: HTMLDivElement | null;
  // Last known anchor position, kept current every `apply()` pass (see
  // `reanchorLostEntries`) so that if a transaction deletes the range
  // containing the widget — DecorationSet.map() then maps it to nothing,
  // per prosemirror-view — the plugin can recreate the widget at this
  // (mapped + clamped) position instead of silently losing the upload UI.
  pos: number;
  // Set synchronously the instant Retry is clicked and cleared once the
  // attempt settles (a fresh failure re-renders the card); guards against a
  // rapid second click firing a second in-flight upload for the same id.
  retrying: boolean;
};

type UploadMeta =
  | { type: 'add'; id: string; file: File; pos: number }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'fail'; id: string }
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string };

export const uploadDecorationsKey = new PluginKey<DecorationSet>('rt-upload-decorations');

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Hand-copied lucide path data — this plugin paints into real DOM nodes
// (ProseMirror widget decorations), not React, so it can't render the
// @tickets/ui icon registry's <Icon> component here the way the rest of the
// toolbar does. circle-alert for the failed slot, rotate-ccw for the Retry
// button, both at design§06's sizes (18px / 12px).
const CIRCLE_ALERT_PATHS =
  '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>';
const ROTATE_CCW_PATHS = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';

function svgIcon(paths: string, size: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = paths;
  return svg;
}

// Uploading card (design§06 "uploading"): bordered rounded-8 slot, dimmed
// hatched 150px preview, caption row (border-top) with mono filename +
// right-aligned percent, 3px accent progress bar on an inset track.
function renderPending(entry: UploadEntry): void {
  entry.root.innerHTML = '';
  entry.root.className =
    'my-1 block w-full max-w-xs overflow-hidden rounded-lg border border-gray-6 bg-surface-raised';
  entry.root.dataset['uploadStatus'] = 'pending';

  const preview = document.createElement('div');
  preview.className = 'h-37.5 opacity-50';
  preview.style.backgroundImage =
    'repeating-linear-gradient(45deg, var(--color-surface-inset) 0 8px, transparent 8px 16px)';

  const caption = document.createElement('div');
  caption.className = 'border-t border-gray-6 px-3 py-2.25';

  const row = document.createElement('div');
  row.className = 'mb-1.75 flex items-center gap-2';
  const name = document.createElement('span');
  name.className = 'min-w-0 flex-1 truncate font-mono text-[11px] text-gray-11';
  name.textContent = entry.file.name;
  const pct = document.createElement('span');
  pct.className = 'shrink-0 font-mono text-[11px] text-gray-9';
  pct.textContent = '0%';
  row.append(name, pct);

  const track = document.createElement('div');
  track.className = 'h-0.75 overflow-hidden rounded-full bg-surface-inset';
  const bar = document.createElement('div');
  bar.className = 'h-full rounded-full bg-indigo-9';
  bar.style.width = '0%';
  track.appendChild(bar);

  caption.append(row, track);
  entry.root.append(preview, caption);
  entry.nameEl = name;
  entry.pctEl = pct;
  entry.barEl = bar;
}

// Progress updates mutate the persisted card DOM directly rather than
// rebuilding/replacing the decoration — the widget's DOM node identity stays
// stable across transactions (see `createEntry`), so this is cheap and never
// touches the DecorationSet.
function updateProgress(entry: UploadEntry, progress: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  if (entry.pctEl) {
    entry.pctEl.textContent = `${clamped}%`;
  }
  if (entry.barEl) {
    entry.barEl.style.width = `${clamped}%`;
  }
}

// Failed card (design§06 "failed"): danger-tinted slot, circle-alert icon,
// "Upload failed" + mono "filename · size", Retry (bordered, rotate-ccw) +
// Remove (ghost). Token choice: the mock's border is #EBC7C3 — a tone
// between --ins-danger and --ins-danger-subtle that isn't in the token set.
// Rather than invent an unmapped hex, this reuses the app's existing
// danger-card convention (border-red-9 + bg-red-3, see
// message-stream.tsx's error card) instead of a bespoke "danger-subtle
// -strong" — full-strength border keeps the failure legible at a glance.
function renderFailed(entry: UploadEntry, handlersRef: UploadHandlersRef): void {
  entry.root.innerHTML = '';
  entry.root.className =
    'my-1 box-border flex h-49 w-full max-w-xs flex-col items-center justify-center gap-1.5 rounded-lg border border-red-9 bg-red-3';
  entry.root.dataset['uploadStatus'] = 'failed';
  entry.nameEl = null;
  entry.pctEl = null;
  entry.barEl = null;
  // A fresh failed card means any in-flight retry has settled (it's the one
  // that just failed) — clear the guard so Retry is clickable again.
  entry.retrying = false;

  const icon = svgIcon(CIRCLE_ALERT_PATHS, 18);
  icon.classList.add('text-red-9');

  const title = document.createElement('span');
  title.className = 'font-sans text-ui font-medium text-gray-12';
  title.textContent = 'Upload failed';

  const meta = document.createElement('span');
  meta.className = 'font-mono text-[11px] text-gray-9';
  meta.textContent = `${entry.file.name} · ${formatFileSize(entry.file.size)}`;

  const actions = document.createElement('div');
  actions.className = 'mt-1.5 flex items-center gap-2';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className =
    'inline-flex h-6.5 items-center gap-1.5 rounded-md border border-gray-7 bg-surface-raised px-2.75 font-sans text-[12px] font-medium text-gray-12';
  retryBtn.append(svgIcon(ROTATE_CCW_PATHS, 12), document.createTextNode('Retry'));
  retryBtn.addEventListener('click', () => {
    // Single-flight guard: a rapid second Retry click (or a stray click on a
    // detached copy of this button) must not start a second XHR for the
    // same upload id. `entry` is the shared mutable record for this id — the
    // flag survives even though the DOM node backing it gets replaced.
    if (entry.retrying) {
      return;
    }
    entry.retrying = true;
    handlersRef.current.onRetry(entry.id, entry.file);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className =
    'inline-flex h-6.5 items-center rounded-md px-2.25 font-sans text-[12px] font-medium text-gray-9 hover:bg-black/4';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => handlersRef.current.onRemove(entry.id));

  actions.append(retryBtn, removeBtn);
  entry.root.append(icon, title, meta, actions);
}

function createEntry(id: string, file: File, pos: number): UploadEntry {
  const root = document.createElement('div');
  root.contentEditable = 'false';
  root.setAttribute('data-upload-card', id);
  const entry: UploadEntry = {
    id,
    file,
    status: 'pending',
    root,
    nameEl: null,
    pctEl: null,
    barEl: null,
    pos,
    retrying: false,
  };
  renderPending(entry);
  return entry;
}

// Runs at the top of every `apply()`, right after `DecorationSet.map()`.
// prosemirror-view maps a widget decoration to nothing when the transaction
// deletes the range containing its anchor — silently dropping the pending/
// failed upload UI even though the upload itself is still alive (or already
// failed and needs Retry/Remove). For every entry still tracked by the
// plugin, check whether its decoration survived the mapping; if not,
// recreate the SAME widget DOM node (identity preserved, so no
// progress/status is lost) at its last known position, mapped through this
// transaction and clamped into the new doc's bounds. Surviving entries get
// their `pos` refreshed so the next loss (if any) re-anchors from an
// up-to-date position rather than a stale one.
function reanchorLostEntries(set: DecorationSet, tr: Transaction, entries: Map<string, UploadEntry>): DecorationSet {
  const docSize = tr.doc.content.size;
  const toAdd: Decoration[] = [];
  for (const [id, entry] of entries) {
    const found = set.find(undefined, undefined, (spec: { uploadId?: string }) => spec.uploadId === id);
    if (found.length > 0) {
      entry.pos = found[0]!.from;
      continue;
    }
    const mapped = tr.mapping.map(entry.pos, -1);
    const clamped = Math.max(0, Math.min(docSize, mapped));
    entry.pos = clamped;
    toAdd.push(Decoration.widget(clamped, entry.root, { key: id, uploadId: id, side: -1 }));
  }
  return toAdd.length > 0 ? set.add(tr.doc, toAdd) : set;
}

// The single source of truth for "where does this upload's insert position
// currently map to" — reads it straight off the live DecorationSet, which
// DecorationSet.map() has already carried through every transaction since
// the decoration was added (see `apply` below). Callers (success insert,
// retry) use this instead of remembering a stale offset themselves.
export function findUploadPos(state: EditorState, id: string): number | null {
  const set = uploadDecorationsKey.getState(state);
  if (!set) {
    return null;
  }
  const found = set.find(undefined, undefined, (spec: { uploadId?: string }) => spec.uploadId === id);
  return found[0]?.from ?? null;
}

function dispatch(view: EditorView, meta: UploadMeta): void {
  view.dispatch(view.state.tr.setMeta(uploadDecorationsKey, meta));
}

export function addUploadDecoration(view: EditorView, id: string, file: File, pos: number): void {
  dispatch(view, { type: 'add', id, file, pos });
}

export function progressUploadDecoration(view: EditorView, id: string, progress: number): void {
  dispatch(view, { type: 'progress', id, progress });
}

export function failUploadDecoration(view: EditorView, id: string): void {
  dispatch(view, { type: 'fail', id });
}

export function retryUploadDecoration(view: EditorView, id: string): void {
  dispatch(view, { type: 'retry', id });
}

export function removeUploadDecoration(view: EditorView, id: string): void {
  dispatch(view, { type: 'remove', id });
}

export function createUploadDecorationsPlugin(handlersRef: UploadHandlersRef): Plugin<DecorationSet> {
  const entries = new Map<string, UploadEntry>();

  return new Plugin<DecorationSet>({
    key: uploadDecorationsKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr: Transaction, old: DecorationSet): DecorationSet {
        let set = old.map(tr.mapping, tr.doc);
        // Runs on EVERY transaction, meta or not — an anchor can be deleted
        // by an ordinary edit that has nothing to do with the upload plugin.
        set = reanchorLostEntries(set, tr, entries);
        const meta = tr.getMeta(uploadDecorationsKey) as UploadMeta | undefined;
        if (!meta) {
          return set;
        }

        if (meta.type === 'add') {
          const entry = createEntry(meta.id, meta.file, meta.pos);
          entries.set(meta.id, entry);
          const deco = Decoration.widget(meta.pos, entry.root, {
            key: meta.id,
            uploadId: meta.id,
            side: -1,
          });
          set = set.add(tr.doc, [deco]);
        } else if (meta.type === 'progress') {
          const entry = entries.get(meta.id);
          if (entry && entry.status === 'pending') {
            updateProgress(entry, meta.progress);
          }
        } else if (meta.type === 'fail') {
          const entry = entries.get(meta.id);
          if (entry) {
            entry.status = 'failed';
            renderFailed(entry, handlersRef);
          }
        } else if (meta.type === 'retry') {
          const entry = entries.get(meta.id);
          if (entry) {
            entry.status = 'pending';
            renderPending(entry);
          }
        } else if (meta.type === 'remove') {
          entries.delete(meta.id);
          const toRemove = set.find(undefined, undefined, (spec: { uploadId?: string }) => spec.uploadId === meta.id);
          set = set.remove(toRemove);
        }

        return set;
      },
    },
    props: {
      decorations(state: EditorState) {
        return uploadDecorationsKey.getState(state) ?? null;
      },
    },
  });
}

export function createUploadDecorationsExtension(handlersRef: UploadHandlersRef) {
  return Extension.create({
    name: 'uploadDecorations',
    addProseMirrorPlugins() {
      return [createUploadDecorationsPlugin(handlersRef)];
    },
  });
}
