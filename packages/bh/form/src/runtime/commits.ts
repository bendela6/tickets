import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { CommitChange } from '../types/commit';

/** `onCommit`: a field committed, with what changed and the form's values after it. */
export type OnCommit = (
  change: CommitChange,
  values: Record<string, unknown>,
) => void | Promise<void>;

/** No draft for the field: what `draftOf` returns, since `undefined` may be a draft. */
export const NO_DRAFT: unique symbol = Symbol('no draft');

/** What the commits read from the form when they run: they outlive the render that made them. */
export interface CommitSource {
  /** Every value now. */
  values: () => Record<string, unknown>;
  /** The visible fields' values now: what `onCommit` and `onSubmit` are given. */
  visibleValues: () => Record<string, unknown>;
  /** Sets one value in the form. */
  setValue: (name: string, value: unknown) => void;
  /** The field's own check, if it has one. */
  validate: (name: string) => StandardSchemaV1 | undefined;
  /** The form's `onCommit`, if it has one. */
  onCommit: () => OnCommit | undefined;
  /** Whether the form has an `onSubmit`: without one it's never dirty. */
  submits: () => boolean;
}

/**
 * A form's commits: the drafts its fields report, the `onCommit` each commit
 * runs, which fields are saving or failed to, and the values last submitted.
 * A store of its own beside the form's values, so a field's draft never joins
 * them until it commits.
 */
export interface Commits {
  subscribe: (listener: () => void) => () => void;
  /** A field committed: its value joins the form's, and `onCommit` runs. */
  commit: (name: string, next: unknown) => void;
  /** A field's draft, as it's typed. One equal to the value is no draft. */
  draft: (name: string, draft: unknown) => void;
  /** The field's draft, or `NO_DRAFT`. */
  draftOf: (name: string) => unknown;
  /** Whether any field holds a draft its value doesn't have. */
  hasDrafts: () => boolean;
  /** Commits every draft: what a Save does first, so nothing typed is lost. */
  flush: () => void;
  /** Whether the field's last commit is still running its `onCommit`. */
  saving: (name: string) => boolean;
  /** Why the field's last commit failed, if it did. */
  error: (name: string) => string | undefined;
  /** Whether any of these fields' last commit failed. */
  failedIn: (names: ReadonlySet<string>) => boolean;
  /** Waits for every `onCommit` still running. */
  settled: () => Promise<void>;
  /** The values last submitted, or undefined before the first submit. */
  baseline: () => Record<string, unknown> | undefined;
  /** A submit succeeded with these values: they're what dirty is measured from. */
  submitted: (values: Record<string, unknown>) => void;
  /** Forgets every draft, saving mark and failure: a reset. */
  clear: () => void;
  /** Whether the form has an `onSubmit`. */
  submits: () => boolean;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return typeof error === 'string' && error !== '' ? error : 'This could not be saved.';
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** Makes a form's commits over what the form gives them. */
export function createCommits(source: CommitSource): Commits {
  const listeners = new Set<() => void>();
  const drafts = new Map<string, unknown>();
  // The latest commit of each field, by number: an older one that settles
  // after a newer one started says nothing about the field any more.
  const latest = new Map<string, number>();
  const saving = new Set<string>();
  const errors = new Map<string, string>();
  const running = new Set<Promise<unknown>>();
  let baseline: Record<string, unknown> | undefined;
  let count = 0;

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const track = (work: Promise<unknown>) => {
    running.add(work);
    void work.finally(() => running.delete(work));
  };

  const settle = (name: string, id: number, failure?: unknown) => {
    if (latest.get(name) !== id) {
      return;
    }
    saving.delete(name);
    if (failure !== undefined) {
      errors.set(name, messageOf(failure));
    }
    emit();
  };

  const run = (change: CommitChange, id: number) => {
    const onCommit = source.onCommit();
    if (!onCommit) {
      return;
    }
    let result: unknown;
    try {
      result = onCommit(change, source.visibleValues());
    } catch (failure) {
      settle(change.field, id, failure ?? new Error());
      return;
    }
    if (isThenable(result)) {
      saving.add(change.field);
      emit();
      track(
        Promise.resolve(result).then(
          () => settle(change.field, id),
          (failure: unknown) => settle(change.field, id, failure ?? new Error()),
        ),
      );
    }
  };

  const commits: Commits = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    commit(name, next) {
      const previous = source.values()[name];
      drafts.delete(name);
      source.setValue(name, next);
      if (Object.is(previous, next) || !source.onCommit()) {
        emit();
        return;
      }
      // This commit supersedes any still running for the field: their outcome
      // no longer describes it, and their failure is no longer its problem.
      const id = ++count;
      latest.set(name, id);
      saving.delete(name);
      errors.delete(name);
      const change = { field: name, value: next, previous };
      // The field's own check comes first: a value it rejects isn't saved,
      // and the field shows why once it's left.
      const check = source.validate(name)?.['~standard'].validate(next);
      if (check instanceof Promise) {
        track(
          check.then((result) => {
            if (!result.issues?.length && latest.get(name) === id) {
              run(change, id);
            }
          }),
        );
      } else if (!check?.issues?.length) {
        run(change, id);
      }
      emit();
    },
    draft(name, draft) {
      if (Object.is(draft, source.values()[name])) {
        drafts.delete(name);
      } else {
        drafts.set(name, draft);
      }
      emit();
    },
    draftOf(name) {
      return drafts.has(name) ? drafts.get(name) : NO_DRAFT;
    },
    hasDrafts() {
      return drafts.size > 0;
    },
    flush() {
      for (const [name, draft] of [...drafts]) {
        commits.commit(name, draft);
      }
    },
    saving(name) {
      return saving.has(name);
    },
    error(name) {
      return errors.get(name);
    },
    failedIn(names) {
      return [...errors.keys()].some((name) => names.has(name));
    },
    async settled() {
      while (running.size > 0) {
        await Promise.allSettled([...running]);
      }
    },
    baseline() {
      return baseline;
    },
    submitted(values) {
      baseline = { ...values };
      emit();
    },
    clear() {
      drafts.clear();
      latest.clear();
      saving.clear();
      errors.clear();
      emit();
    },
    submits() {
      return source.submits();
    },
  };
  return commits;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Whether two form values hold the same data: arrays and plain objects by
 * what's in them, anything else (a `File`, a `Date`) by identity. A key
 * that's missing and one that's undefined are the same.
 */
export function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValues(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameValues(a[key], b[key]));
  }
  return false;
}
