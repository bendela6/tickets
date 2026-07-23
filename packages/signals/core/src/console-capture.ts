import type { SignalsClient } from './client';
import type { SignalLevel } from './types';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

const CONSOLE_METHODS: ConsoleMethod[] = ['log', 'info', 'warn', 'error'];

const METHOD_LEVEL: Record<ConsoleMethod, SignalLevel> = {
  log: 'info',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const LEVEL_RANK: Record<SignalLevel, number> = { info: 0, warning: 1, error: 2 };

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    // circular refs, BigInt, etc. — fall back to String() rather than throw
    try {
      return String(arg);
    } catch {
      return '<unserializable>';
    }
  }
}

function joinArgs(args: unknown[]): string {
  try {
    return args.map(stringifyArg).join(' ');
  } catch {
    return '<unserializable console args>';
  }
}

// module-scoped: console is global, so a second install (e.g. a repeat
// `initSignals` call) must be a no-op rather than double-wrapping it.
let installedOriginals: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> | null = null;

// re-entrancy guard: if client.captureLog(...) itself logs to console (directly
// or via a beforeSend hook, transport error, etc.), that inner console call must
// not trigger another captureLog — otherwise a logging client could loop forever.
let capturing = false;

/**
 * Patches console.log/info/warn/error so calls at or above `floor` also flow
 * into `client.captureLog(...)`. Always calls through to the original console
 * method first, so normal logging is unaffected. Never throws into the host app.
 *
 * Returns an uninstall function that restores the original console methods.
 */
export function installConsoleCapture(client: SignalsClient, floor: SignalLevel): () => void {
  if (installedOriginals) {
    // already installed globally — idempotent no-op
    return () => {};
  }

  // `floor` often originates from an unvalidated env knob (SIGNALS_LOG_LEVEL /
  // VITE_SIGNALS_LOG_LEVEL) cast to SignalLevel. A garbage value would make
  // LEVEL_RANK[floor] undefined and, since `n < undefined` is always false,
  // capture EVERYTHING (info+) — a noise flood. Fall back to the 'warning' floor.
  const floorRank = LEVEL_RANK[floor] ?? LEVEL_RANK.warning;

  const originals: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};
  const wrapped: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};

  for (const method of CONSOLE_METHODS) {
    // capture the raw reference — NOT `.bind(console)`, which would mint a new
    // function identity. Other instrumentation (e.g. the browser package's own
    // breadcrumb patch) restores itself with `console[method] === wrapped`, and
    // that check can only ever match a patch layered on top of the *exact* prior
    // reference. `.call(console, ...)` below preserves `this` without rebinding.
    const original = console[method];
    originals[method] = original;

    wrapped[method] = (...args: unknown[]) => {
      // always call through first — the SDK must never suppress normal logging
      original.call(console, ...args);

      if (capturing) return;
      const level = METHOD_LEVEL[method];
      if (LEVEL_RANK[level] < floorRank) return;

      capturing = true;
      try {
        client.captureLog(joinArgs(args), level);
      } catch {
        // never let capture bookkeeping throw into the host app's console call
      } finally {
        capturing = false;
      }
    };
    console[method] = wrapped[method]!;
  }

  installedOriginals = originals;

  return () => {
    for (const method of CONSOLE_METHODS) {
      // defensive: only restore if nothing else re-patched console[method] after us
      if (console[method] === wrapped[method]) console[method] = originals[method]!;
    }
    installedOriginals = null;
  };
}
