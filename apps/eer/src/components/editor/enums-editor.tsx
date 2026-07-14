// The enum manager (frames 2a/2b of the EER Modal Spec), a child of
// model-modal.tsx the way constraints-editor.tsx is a child of table-modal.tsx.
//
// Unlike the table editor's per-tab drafts (accumulated locally, dispatched as
// ONE upsertEntity at Save), an enum's declaration lives at the MODEL level
// and is shared by every column across every table that names it — so every
// mutation here dispatches its own engine edit (upsertEnum / renameEnum /
// deleteEnum) IMMEDIATELY, never deferred to the modal's own Save button
// (title/description are still `setMeta`-on-Save; see model-modal.tsx). The
// one deliberate exception is the NAME input: it commits on blur, not per
// keystroke — a half-typed name must not spam renameEnum and thrash the
// cascade it triggers (every column typed to the old name gets rewritten on
// every call). Value add/remove/reorder are discrete clicks (or an Enter on
// the adder), not free text typed into an existing chip, so they dispatch
// straight away with no such concern.
//
// Deleting an enum still referenced by a column is REFUSED (frame 2b) — the
// engine's deleteEnum throws rather than orphaning a column's type (see
// apply-model-edit.ts). Rather than dispatch a doomed edit and read the
// failure back off ui.editError (a single modal-wide banner — see
// model-modal.tsx), this editor pre-checks via the engine's own enumRefsTo
// and renders an at-the-mistake strip UNDER the one card that was blocked,
// mirroring the FK-target refusal pattern in the table editor (frame 1f).
// Every OTHER card stays fully interactive — the block is per-row local
// state (`deleteBlocked`), never a global flag.
//
// A brand-new row added via "+ add enum" has no engine-side existence at all
// until its name is committed (`committedName` is null) — deleting THAT row
// is a pure local discard (no dispatch, no refusal check possible: it isn't
// in model.enums yet). Committing a new row's name goes through upsertEnum,
// which is an UPSERT by name — silently overwriting an existing enum the
// moment a fresh row's name happens to collide would be a data-loss surprise
// (the same hazard TableModal/GroupModal guard against for entity/group ids),
// so that collision is blocked here rather than dispatched.

import { useRef, useState } from 'react';

import { applyModelEdit as tryApplyModelEdit, enumRefsTo, type ModelEdit } from '../../engine/model/apply-model-edit';
import type { Model } from '../../engine/model/types';
import { cn } from '../../ui/cn';

const card = cn('flex flex-col gap-2 rounded-xl border border-gray-600 bg-gray-900 p-3');
const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const inputInvalid = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'text-xs text-red-200');
const addBtn = cn('rounded-md border border-dashed border-gray-600 px-2 py-1', 'text-xs text-gray-200 hover:bg-gray-800');
const iconBtn = cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', 'text-gray-400 hover:bg-gray-800 hover:text-gray-50');
const iconBtnDisabled = cn(iconBtn, 'disabled:pointer-events-none disabled:opacity-30');
const errMsg = cn('rounded border border-red-600 bg-red-950 px-2 py-1', 'font-mono text-xs text-red-400');
const chip = cn('flex items-center gap-1 rounded border border-gray-600 bg-gray-900', 'px-1 py-1');
const chipNum = 'font-mono text-3xs text-gray-500';
const valueAdder = cn('w-24 rounded border border-dashed border-gray-600 bg-gray-900', 'px-2 py-1 text-xs text-gray-50');

interface EnumDraft {
  key: string;
  committedName: string | null; // null = added locally via "+ add enum", not yet in model.enums
  name: string; // live input text — may be mid-edit, ahead of committedName
  values: string[];
  schema: string | null;
  nameError: string | null;
  deleteBlocked: { entityId: string; column: string }[] | null;
  pendingValue: string; // the "+ value" adder's own live text
}

function fromEnum(e: { name: string; values: string[]; schema: string | null }): EnumDraft {
  return {
    key: e.name,
    committedName: e.name,
    name: e.name,
    values: e.values,
    schema: e.schema,
    nameError: null,
    deleteBlocked: null,
    pendingValue: '',
  };
}

export interface EnumsEditorProps {
  model: Model;
  onApplyEdit: (edit: ModelEdit) => void;
}

export function EnumsEditor({ model, onApplyEdit }: EnumsEditorProps) {
  const [drafts, setDrafts] = useState<EnumDraft[]>(() => model.enums.map(fromEnum));
  const keySeq = useRef(0);
  const nextKey = () => `new-${++keySeq.current}`;

  const patch = (key: string, next: Partial<EnumDraft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...next } : x)));

  const addEnum = () =>
    setDrafts((d) => [
      ...d,
      { key: nextKey(), committedName: null, name: '', values: [], schema: null, nameError: null, deleteBlocked: null, pendingValue: '' },
    ]);

  const commitName = (key: string) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    const trimmed = draft.name.trim();
    if (trimmed === (draft.committedName ?? '')) return; // no-op edit, or still-blank uncommitted row

    if (!trimmed) {
      // Reject a blank rename of an already-committed enum — revert instead
      // of dispatching (renameEnum/upsertEnum would themselves throw on a
      // blank name; reverting here keeps that a UI-level no-op).
      patch(key, { name: draft.committedName ?? '', nameError: null });
      return;
    }

    if (draft.committedName === null) {
      if (model.enums.some((e) => e.name === trimmed)) {
        patch(key, { nameError: `An enum named "${trimmed}" already exists.` });
        return;
      }
      const edit: ModelEdit = { kind: 'upsertEnum', enum: { name: trimmed, values: draft.values, schema: draft.schema } };
      try {
        tryApplyModelEdit(model, edit);
      } catch (err) {
        patch(key, { nameError: err instanceof Error ? err.message : String(err) });
        return;
      }
      onApplyEdit(edit);
      patch(key, { committedName: trimmed, name: trimmed, nameError: null, deleteBlocked: null });
      return;
    }

    const edit: ModelEdit = { kind: 'renameEnum', from: draft.committedName, to: trimmed };
    try {
      tryApplyModelEdit(model, edit);
    } catch (err) {
      patch(key, { nameError: err instanceof Error ? err.message : String(err) });
      return;
    }
    onApplyEdit(edit);
    patch(key, { committedName: trimmed, name: trimmed, nameError: null, deleteBlocked: null });
  };

  // Shared tail for every value mutation (add/remove/reorder): update the
  // local chip list, then — only once the enum actually exists in the model
  // — re-upsert it with the new values so DDL order (never sorted) survives
  // save→reload same as everything else in the model.
  const setValues = (key: string, values: string[]) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    patch(key, { values, deleteBlocked: null });
    if (draft.committedName !== null) {
      onApplyEdit({ kind: 'upsertEnum', enum: { name: draft.committedName, values, schema: draft.schema } });
    }
  };

  const addValue = (key: string) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    const trimmed = draft.pendingValue.trim();
    if (!trimmed) return;
    setValues(key, [...draft.values, trimmed]);
    patch(key, { pendingValue: '' });
  };

  const removeValue = (key: string, i: number) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    setValues(
      key,
      draft.values.filter((_, j) => j !== i),
    );
  };

  const moveValue = (key: string, i: number, dir: -1 | 1) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.values.length) return;
    const next = draft.values.slice();
    const here = next[i]!;
    next[i] = next[j]!;
    next[j] = here;
    setValues(key, next);
  };

  const deleteEnum = (key: string) => {
    const draft = drafts.find((x) => x.key === key);
    if (!draft) return;
    if (draft.committedName === null) {
      setDrafts((d) => d.filter((x) => x.key !== key));
      return;
    }
    const refs = enumRefsTo(model, draft.committedName);
    if (refs.length > 0) {
      patch(key, { deleteBlocked: refs });
      return;
    }
    onApplyEdit({ kind: 'deleteEnum', name: draft.committedName });
    setDrafts((d) => d.filter((x) => x.key !== key));
  };

  return (
    <div className="flex flex-col gap-2">
      {drafts.map((draft, i) => {
        const n = i + 1;
        return (
          <div key={draft.key} className={card}>
            <div className="flex items-center gap-2">
              <input
                className={cn(draft.nameError ? inputInvalid : input, 'w-32')}
                aria-label={`Enum ${n} name`}
                value={draft.name}
                onChange={(e) => patch(draft.key, { name: e.target.value, nameError: null })}
                onBlur={() => commitName(draft.key)}
              />
              <button
                type="button"
                className={cn(iconBtn, 'ml-auto')}
                aria-label={`Delete enum ${draft.committedName ?? draft.name}`}
                onClick={() => deleteEnum(draft.key)}
              >
                ✕
              </button>
            </div>

            {draft.nameError && <p className={errMsg}>{draft.nameError}</p>}

            <div className="flex flex-wrap items-center gap-2">
              {draft.values.map((v, vi) => (
                <div key={vi} className={chip}>
                  <span className={chipNum}>{vi + 1}</span>
                  <span className="text-xs text-gray-100">{v}</span>
                  <button
                    type="button"
                    className={iconBtnDisabled}
                    aria-label={`Move enum ${n} value ${vi + 1} up`}
                    disabled={vi === 0}
                    onClick={() => moveValue(draft.key, vi, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={iconBtnDisabled}
                    aria-label={`Move enum ${n} value ${vi + 1} down`}
                    disabled={vi === draft.values.length - 1}
                    onClick={() => moveValue(draft.key, vi, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={`Remove enum ${n} value ${vi + 1}`}
                    onClick={() => removeValue(draft.key, vi)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <input
                className={valueAdder}
                placeholder="+ value"
                aria-label={`Enum ${n} add value`}
                value={draft.pendingValue}
                onChange={(e) => patch(draft.key, { pendingValue: e.target.value })}
                onBlur={() => addValue(draft.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addValue(draft.key);
                  }
                }}
              />
            </div>

            {draft.deleteBlocked && (
              <p className={errMsg}>
                Can&apos;t delete &quot;{draft.committedName}&quot; — {draft.deleteBlocked.length} column
                {draft.deleteBlocked.length === 1 ? '' : 's'} use it:{' '}
                {draft.deleteBlocked.map((r) => `${r.entityId}.${r.column}`).join(', ')}. Change those column types first.
              </p>
            )}
          </div>
        );
      })}

      <button type="button" className={addBtn} onClick={addEnum}>
        + add enum
      </button>
    </div>
  );
}
