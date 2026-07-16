# AI Sessions v2 — Shell + Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the AI-sessions UI into a workbench (activity rail + mode panel with separate Terminals/Agents lists) and fix the composer (Send↔Stop toggle + context/token meters).

**Architecture:** Front-end-heavy. The one backend change threads the SDK `result.usage` through the existing `result` `AgentEvent` (currently dropped) so the client can render token meters. The shell splits `AppShell` into an always-visible activity rail and a mode panel whose contents are chosen by the current route; the two session lists live in the panel, and the main area shows the selected session (or a placeholder). No protocol, schema, or dispatch changes.

**Tech Stack:** React 19, TanStack Router (code-based) + Query, Tailwind v4 (Instrument, preflight ON), radix-ui `DropdownMenu`, vitest + Testing Library. API: Fastify 5, the Claude Agent SDK adapter (`mapSdkMessage`).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-16-ai-sessions-v2-shell-composer-design.md`.
- One commit per task; conventional commits scoped by app (`feat(web):`, `feat(api):`).
- Tailwind **preflight is ON** on this branch; do not reintroduce preflight-off workarounds.
- Token meters are **client-derived** — no new DB columns, no persistence changes.
- **"Tokens spent" = cumulative output tokens** (not input; input re-sends context each turn and would double-count). Context fill = the **last** turn's input tokens vs a per-model window.
- Per-model context windows: `claude-opus-4-8` = 1_000_000; `claude-sonnet-5` = 200_000; `claude-haiku-4-5-20251001` = 200_000; unknown → 200_000.
- Existing suites must stay green: 132 api + 116 web + 18 db. Run `pnpm typecheck` and `pnpm --filter @tickets/web test` / `pnpm --filter @tickets/api test` as noted.
- Dev stack for manual checks: api :4700 / web :4720 (http://localhost:4720) / DB `tickets_e2dev`.
- Universal session viewer route `/ai/$sessionId` is **unchanged**.

---

## File Structure

**API**
- `apps/api/src/ai/types.ts` — extend `result` `AgentEvent` with optional `usage`.
- `apps/api/src/ai/providers/map-sdk-message.ts` — extract `usage` from the SDK result.
- `apps/api/src/ai/providers/map-sdk-message.test.ts` — new usage cases.

**Web — composer/meters (B)**
- `apps/web/src/api/types.ts` — mirror the `usage` field.
- `apps/web/src/components/ai/agent-models.ts` (new) — `CONTEXT_WINDOW`, `contextWindowFor`, `formatTokens`.
- `apps/web/src/components/ai/agent-models.test.ts` (new).
- `apps/web/src/components/ai/derive-usage.ts` (new) — fold result events → `{ contextTokens, tokensOut, cacheReadTokens }`.
- `apps/web/src/components/ai/derive-usage.test.ts` (new).
- `apps/web/src/components/ai/context-meter.tsx` (new) + `.test.tsx`.
- `apps/web/src/components/ai/prompt-composer.tsx` — Send↔Stop toggle.
- `apps/web/src/components/ai/prompt-composer.test.tsx` (new).
- `apps/web/src/components/ai/agent-session-screen.tsx` — mount `ContextMeter`; header ⋯ menu; drop top-right Stop.
- `apps/web/src/components/ai/ai-session-screen.tsx` — header ⋯ menu (End session) parity.

**Web — shell (A)**
- `apps/web/src/components/shell/mode-for-path.ts` (new) + `.test.ts`.
- `apps/web/src/components/ai/select-sessions.ts` (new) + `.test.ts` — `terminalsOf` / `agentsOf`.
- `apps/web/src/components/ai/session-list.tsx` (new) — shared panel list/tree rows (moved from `ai-sessions-screen.tsx`).
- `apps/web/src/components/shell/activity-rail.tsx` (new).
- `apps/web/src/components/shell/tasks-panel.tsx` (new) — today's projects nav.
- `apps/web/src/components/shell/terminals-panel.tsx`, `agents-panel.tsx` (new).
- `apps/web/src/components/shell/mode-panel.tsx` (new) — dispatch by mode.
- `apps/web/src/components/shell/app-shell.tsx` — recompose into rail + panel + main; mode-from-route.
- `apps/web/src/routes/terminals-route.tsx`, `agents-route.tsx`, `agents-personas-route.tsx`, `agent-profile-route.tsx` (rename targets) + `ai-route.tsx` redirect; register in the router.
- Retire `apps/web/src/components/ai/ai-sessions-screen.tsx` (logic moved to panels + `session-list.tsx`).

---

# Phase B — Composer + meters

## Task 1: Thread SDK token usage through the `result` event

**Files:**
- Modify: `apps/api/src/ai/types.ts:39`
- Modify: `apps/api/src/ai/providers/map-sdk-message.ts:72-80`
- Modify: `apps/web/src/api/types.ts:323`
- Test: `apps/api/src/ai/providers/map-sdk-message.test.ts`

**Interfaces:**
- Produces: `result` `AgentEvent` gains `usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number }` (identical shape in both `types.ts` files).

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/ai/providers/map-sdk-message.test.ts`:

```ts
it('maps result usage into the result event', () => {
  const events = mapSdkMessage({
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0.12,
    duration_ms: 3400,
    is_error: false,
    usage: {
      input_tokens: 72000,
      output_tokens: 1500,
      cache_read_input_tokens: 60000,
      cache_creation_input_tokens: 200,
    },
  } as never);
  expect(events).toEqual([
    {
      type: 'result',
      costUsd: 0.12,
      durationMs: 3400,
      isError: false,
      usage: {
        inputTokens: 72000,
        outputTokens: 1500,
        cacheReadTokens: 60000,
        cacheCreationTokens: 200,
      },
    },
  ]);
});

it('omits usage when the result carries none', () => {
  const events = mapSdkMessage({
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0.01,
    duration_ms: 10,
    is_error: false,
  } as never);
  expect(events[0]).not.toHaveProperty('usage');
});

it('defaults missing usage token fields to 0', () => {
  const events = mapSdkMessage({
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0,
    duration_ms: 0,
    is_error: false,
    usage: { output_tokens: 42 },
  } as never);
  expect(events[0]).toMatchObject({
    usage: { inputTokens: 0, outputTokens: 42, cacheReadTokens: 0, cacheCreationTokens: 0 },
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tickets/api test -- map-sdk-message`
Expected: FAIL — result event has no `usage`.

- [ ] **Step 3: Extend the `result` AgentEvent type**

In `apps/api/src/ai/types.ts`, replace the line:

```ts
  | { type: 'result'; costUsd: number; durationMs: number; isError: boolean }
```

with:

```ts
  | {
      type: 'result';
      costUsd: number;
      durationMs: number;
      isError: boolean;
      usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
```

Make the identical replacement in `apps/web/src/api/types.ts` (the mirror at line ~323).

- [ ] **Step 4: Extract usage in the mapper**

In `apps/api/src/ai/providers/map-sdk-message.ts`, replace the `case 'result':` block:

```ts
    case 'result': {
      const raw = (msg as { usage?: Record<string, number> }).usage;
      const usage = raw
        ? {
            inputTokens: raw.input_tokens ?? 0,
            outputTokens: raw.output_tokens ?? 0,
            cacheReadTokens: raw.cache_read_input_tokens ?? 0,
            cacheCreationTokens: raw.cache_creation_input_tokens ?? 0,
          }
        : undefined;
      return [
        {
          type: 'result',
          costUsd: msg.total_cost_usd,
          durationMs: msg.duration_ms,
          isError: msg.is_error,
          ...(usage ? { usage } : {}),
        },
      ];
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/api test -- map-sdk-message`
Expected: PASS (including the pre-existing result test).

- [ ] **Step 6: Typecheck both apps**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ai/types.ts apps/api/src/ai/providers/map-sdk-message.ts apps/api/src/ai/providers/map-sdk-message.test.ts apps/web/src/api/types.ts
git commit -m "feat(api): thread SDK result.usage token counts through the result event"
```

---

## Task 2: `agent-models.ts` — context windows + token formatting

**Files:**
- Create: `apps/web/src/components/ai/agent-models.ts`
- Test: `apps/web/src/components/ai/agent-models.test.ts`

**Interfaces:**
- Produces: `CONTEXT_WINDOW: Record<string, number>`, `contextWindowFor(model?: string | null): number`, `formatTokens(n: number): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ai/agent-models.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contextWindowFor, formatTokens } from './agent-models';

describe('contextWindowFor', () => {
  it('knows per-model windows', () => {
    expect(contextWindowFor('claude-opus-4-8')).toBe(1_000_000);
    expect(contextWindowFor('claude-sonnet-5')).toBe(200_000);
    expect(contextWindowFor('claude-haiku-4-5-20251001')).toBe(200_000);
  });
  it('falls back to 200k for unknown or missing models', () => {
    expect(contextWindowFor('mystery')).toBe(200_000);
    expect(contextWindowFor(null)).toBe(200_000);
    expect(contextWindowFor(undefined)).toBe(200_000);
  });
});

describe('formatTokens', () => {
  it('formats across magnitudes', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(948)).toBe('948');
    expect(formatTokens(72_000)).toBe('72k');
    expect(formatTokens(1_200_000)).toBe('1.2M');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @tickets/web test -- agent-models`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/ai/agent-models.ts`:

```ts
// Per-model context windows (tokens). Configurable; unknown models fall back
// to the conservative 200k. Mirrors the models the Claude provider offers.
export const CONTEXT_WINDOW: Record<string, number> = {
  'claude-opus-4-8': 1_000_000,
  'claude-sonnet-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
};

export function contextWindowFor(model?: string | null): number {
  return (model && CONTEXT_WINDOW[model]) || 200_000;
}

// Compact token count for meters: 0 · 948 · 72k · 1.2M.
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/web test -- agent-models`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/agent-models.ts apps/web/src/components/ai/agent-models.test.ts
git commit -m "feat(web): context-window + token-formatting helpers for the session meters"
```

---

## Task 3: `deriveUsage` + `ContextMeter`

**Files:**
- Create: `apps/web/src/components/ai/derive-usage.ts`
- Create: `apps/web/src/components/ai/context-meter.tsx`
- Test: `apps/web/src/components/ai/derive-usage.test.ts`, `apps/web/src/components/ai/context-meter.test.tsx`

**Interfaces:**
- Consumes: `AgentEvent` (`apps/web/src/api/types.ts`), `formatTokens` (Task 2).
- Produces: `deriveUsage(events: AgentEvent[]): { contextTokens: number | null; tokensOut: number; cacheReadTokens: number }`; `ContextMeter({ contextTokens, contextWindow, tokensOut, cacheReadTokens?, className? })`.

- [ ] **Step 1: Write the failing `deriveUsage` test**

Create `apps/web/src/components/ai/derive-usage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../../api/types';
import { deriveUsage } from './derive-usage';

const result = (usage?: AgentEvent extends { type: 'result' } ? never : never) => usage; // typing helper unused

describe('deriveUsage', () => {
  it('returns nulls/zeroes with no result events', () => {
    expect(deriveUsage([{ type: 'assistant_text', text: 'hi' } as AgentEvent])).toEqual({
      contextTokens: null,
      tokensOut: 0,
      cacheReadTokens: 0,
    });
  });

  it('takes the last input tokens as context and sums output tokens', () => {
    const events: AgentEvent[] = [
      {
        type: 'result',
        costUsd: 0.1,
        durationMs: 1,
        isError: false,
        usage: { inputTokens: 40000, outputTokens: 1000, cacheReadTokens: 30000, cacheCreationTokens: 0 },
      },
      {
        type: 'result',
        costUsd: 0.2,
        durationMs: 1,
        isError: false,
        usage: { inputTokens: 72000, outputTokens: 1500, cacheReadTokens: 60000, cacheCreationTokens: 0 },
      },
    ];
    expect(deriveUsage(events)).toEqual({ contextTokens: 72000, tokensOut: 2500, cacheReadTokens: 90000 });
  });

  it('ignores result events with no usage', () => {
    const events: AgentEvent[] = [{ type: 'result', costUsd: 0, durationMs: 0, isError: false }];
    expect(deriveUsage(events)).toEqual({ contextTokens: null, tokensOut: 0, cacheReadTokens: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- derive-usage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `deriveUsage`**

Create `apps/web/src/components/ai/derive-usage.ts`:

```ts
import type { AgentEvent } from '../../api/types';

// Fold the run's result events into the meter inputs. Context = the LAST turn's
// input tokens (the full context that was sent). Tokens-out = cumulative output
// across turns (input can't be summed — it re-sends context each turn).
export function deriveUsage(events: AgentEvent[]): {
  contextTokens: number | null;
  tokensOut: number;
  cacheReadTokens: number;
} {
  let contextTokens: number | null = null;
  let tokensOut = 0;
  let cacheReadTokens = 0;
  for (const event of events) {
    if (event.type === 'result' && event.usage) {
      contextTokens = event.usage.inputTokens;
      tokensOut += event.usage.outputTokens;
      cacheReadTokens += event.usage.cacheReadTokens;
    }
  }
  return { contextTokens, tokensOut, cacheReadTokens };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tickets/web test -- derive-usage`
Expected: PASS. (Delete the unused `result` helper line if the linter complains.)

- [ ] **Step 5: Write the failing `ContextMeter` test**

Create `apps/web/src/components/ai/context-meter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContextMeter } from './context-meter';

describe('ContextMeter', () => {
  it('renders nothing until there is a context reading', () => {
    const { container } = render(
      <ContextMeter contextTokens={null} contextWindow={200_000} tokensOut={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows context fill and tokens out', () => {
    render(<ContextMeter contextTokens={72_000} contextWindow={200_000} tokensOut={148_000} />);
    expect(screen.getByText('72k / 200k')).toBeInTheDocument();
    expect(screen.getByText('148k')).toBeInTheDocument();
  });

  it('marks the fill as over budget near the window', () => {
    render(<ContextMeter contextTokens={195_000} contextWindow={200_000} tokensOut={0} />);
    expect(screen.getByTestId('context-fill').className).toContain('text-danger');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- context-meter`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `ContextMeter`**

Create `apps/web/src/components/ai/context-meter.tsx`:

```tsx
import { cn } from '../../ui/cn';
import { formatTokens } from './agent-models';

// Context-window fill + cumulative output tokens, shown beside the CostMeter in
// the agent session header. Absent until the first result arrives. Turns danger
// once the context is ≥90% of the model window.
export function ContextMeter({
  contextTokens,
  contextWindow,
  tokensOut,
  cacheReadTokens,
  className,
}: {
  contextTokens: number | null;
  contextWindow: number;
  tokensOut: number;
  cacheReadTokens?: number;
  className?: string;
}) {
  if (contextTokens == null) return null;
  const pct = Math.min(100, (contextTokens / contextWindow) * 100);
  const hot = contextTokens >= contextWindow * 0.9;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 rounded-md border border-hairline bg-raised px-2',
        className,
      )}
      title={
        `context ${formatTokens(contextTokens)} of ${formatTokens(contextWindow)}` +
        (cacheReadTokens ? ` · ${formatTokens(cacheReadTokens)} cache read` : '')
      }
    >
      <span
        data-testid="context-fill"
        className={cn('font-mono text-meta', hot ? 'text-danger' : 'text-ink')}
      >
        ▣ {formatTokens(contextTokens)} / {formatTokens(contextWindow)}
      </span>
      <span className="inline-flex h-1 w-9 overflow-hidden rounded-full bg-inset">
        <span className={cn('h-full', hot ? 'bg-danger' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-meta text-ink-3" title="output tokens generated">
        ↓ {formatTokens(tokensOut)}
      </span>
    </span>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm --filter @tickets/web test -- context-meter derive-usage`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ai/derive-usage.ts apps/web/src/components/ai/derive-usage.test.ts apps/web/src/components/ai/context-meter.tsx apps/web/src/components/ai/context-meter.test.tsx
git commit -m "feat(web): ContextMeter + deriveUsage for token/context reporting"
```

---

## Task 4: PromptComposer Send↔Stop toggle

**Files:**
- Modify: `apps/web/src/components/ai/prompt-composer.tsx:74-82`
- Test: `apps/web/src/components/ai/prompt-composer.test.tsx` (new)

**Interfaces:**
- Consumes: existing `PromptComposer` props (unchanged signature).
- Produces: while `running`, the primary button reads `■ Stop` and calls `onInterrupt`; otherwise `Send` calling `onSend`, disabled on empty/`disabled`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ai/prompt-composer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromptComposer } from './prompt-composer';

const base = {
  value: 'hello',
  onChange: () => {},
  model: 'claude-opus-4-8',
  onModelChange: () => {},
  effort: 'medium',
  onEffortChange: () => {},
};

describe('PromptComposer run control', () => {
  it('shows Send when idle and calls onSend', async () => {
    const onSend = vi.fn();
    render(<PromptComposer {...base} onSend={onSend} onInterrupt={() => {}} running={false} />);
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('replaces Send with Stop while running and calls onInterrupt', async () => {
    const onInterrupt = vi.fn();
    render(<PromptComposer {...base} onSend={() => {}} onInterrupt={onInterrupt} running />);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('disables Send with empty input', () => {
    render(<PromptComposer {...base} value="  " onSend={() => {}} onInterrupt={() => {}} running={false} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- prompt-composer`
Expected: FAIL — while running both `Send` and `Stop` render today (the test asserts `Send` is absent).

- [ ] **Step 3: Implement the toggle**

In `apps/web/src/components/ai/prompt-composer.tsx`, replace the button cluster (the `{running ? … }` + `Send` `<Button>` block after `<span className="flex-1" />`) with:

```tsx
        <span className="flex-1" />
        {running ? (
          <Button size="compact" variant="secondary" onClick={onInterrupt}>
            ■ Stop
          </Button>
        ) : (
          <Button
            size="compact"
            variant="primary"
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            Send
          </Button>
        )}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tickets/web test -- prompt-composer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/prompt-composer.tsx apps/web/src/components/ai/prompt-composer.test.tsx
git commit -m "feat(web): composer Send button becomes Stop while a turn runs"
```

---

## Task 5: Wire meters + ⋯ End-session menu into the session screens

**Files:**
- Modify: `apps/web/src/components/ai/agent-session-screen.tsx`
- Modify: `apps/web/src/components/ai/ai-session-screen.tsx`

**Interfaces:**
- Consumes: `deriveUsage` (Task 3), `ContextMeter` (Task 3), `contextWindowFor` (Task 2), `Menu`/`MenuTrigger`/`MenuContent`/`MenuItem` (`apps/web/src/ui/menu.tsx`), `useStopAiSession`.
- Produces: no exported API change; header now has meters + a ⋯ menu, and the destructive top-right Stop is gone.

- [ ] **Step 1: Add a session-actions menu to the agent header**

In `apps/web/src/components/ai/agent-session-screen.tsx`:

1. Add imports:

```tsx
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu';
import { ContextMeter } from './context-meter';
import { contextWindowFor } from './agent-models';
import { deriveUsage } from './derive-usage';
```

2. After the `cost` line, derive the meter inputs from the run's events:

```tsx
  const usage = useMemo(
    () => deriveUsage(entries.flatMap((e) => (e.kind === 'event' ? [e.event] : []))),
    [entries],
  );
```

3. Replace the header right cluster — the `<CostMeter … />`, `<SessionStatusPill … />`, and the destructive `<Button …>Stop</Button>` — with:

```tsx
        <ContextMeter
          contextTokens={usage.contextTokens}
          contextWindow={contextWindowFor(model)}
          tokensOut={usage.tokensOut}
          cacheReadTokens={usage.cacheReadTokens}
        />
        <CostMeter costUsd={cost} />
        <SessionStatusPill status={status} exitCode={socket.exitCode ?? data?.exitCode ?? null} />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Session actions"
              className="inline-flex size-6 items-center justify-center rounded-md border border-hairline bg-raised font-sans text-ink-2 hover:border-control"
            >
              ⋯
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              destructive
              onSelect={() => {
                if (window.confirm('End this session? The process will be stopped.')) {
                  stop.mutate(sessionId);
                }
              }}
            >
              End session
            </MenuItem>
          </MenuContent>
        </Menu>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. Confirm `useMemo` is imported (it already is) and the removed `Button`/`variant="destructive"` usage doesn't leave an unused import — `Button` is still used elsewhere in the file, so keep the import.

- [ ] **Step 3: Add the same ⋯ End-session menu to the terminal header**

Open `apps/web/src/components/ai/ai-session-screen.tsx`. Locate its header row (the `← sessions` bar with the status pill). Add the same imports (`Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`) and, if not present, `useStopAiSession`. Place the ⋯ menu at the right end of the header, mirroring Step 1's `<Menu>…</Menu>` block (wire `stop.mutate(sessionId)` the same way). If a destructive Stop button already exists in that header, remove it in favour of the menu.

- [ ] **Step 4: Typecheck + full web suite**

Run: `pnpm typecheck && pnpm --filter @tickets/web test`
Expected: PASS (116 existing + new tests).

- [ ] **Step 5: Manual smoke (dev stack)**

Open http://localhost:4720, start/attach an agent session. Confirm: while a turn runs the composer button is **■ Stop** and clicking it interrupts; when idle it is **Send**; the header shows the context meter (once a result lands) and cost; the ⋯ menu ends the session. (Requires `ANTHROPIC_API_KEY` in the api env for a real turn; otherwise verify the layout with a seeded session.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ai/agent-session-screen.tsx apps/web/src/components/ai/ai-session-screen.tsx
git commit -m "feat(web): session headers gain context/token meters and a ⋯ End-session menu"
```

---

# Phase A — Workbench shell

## Task 6: `modeForPath` route→mode helper

**Files:**
- Create: `apps/web/src/components/shell/mode-for-path.ts`
- Test: `apps/web/src/components/shell/mode-for-path.test.ts`

**Interfaces:**
- Consumes: `SessionKind` (`apps/web/src/api/types.ts`).
- Produces: `type Mode = 'tasks' | 'terminals' | 'agents'`; `modeForPath(pathname: string, sessionKind?: SessionKind | null): Mode | null`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/shell/mode-for-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { modeForPath } from './mode-for-path';

describe('modeForPath', () => {
  it('maps task routes', () => {
    expect(modeForPath('/')).toBe('tasks');
    expect(modeForPath('/all')).toBe('tasks');
    expect(modeForPath('/p/APP')).toBe('tasks');
    expect(modeForPath('/p/APP/v/3')).toBe('tasks');
  });
  it('maps terminal and agent list routes', () => {
    expect(modeForPath('/terminals')).toBe('terminals');
    expect(modeForPath('/agents')).toBe('agents');
    expect(modeForPath('/agents/personas')).toBe('agents');
    expect(modeForPath('/agents/personas/5')).toBe('agents');
  });
  it('follows the loaded session kind for the universal viewer', () => {
    expect(modeForPath('/ai/12', 'agent')).toBe('agents');
    expect(modeForPath('/ai/12', 'terminal')).toBe('terminals');
    expect(modeForPath('/ai/12', null)).toBeNull();
    expect(modeForPath('/ai/12')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- mode-for-path`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/shell/mode-for-path.ts`:

```ts
import type { SessionKind } from '../../api/types';

export type Mode = 'tasks' | 'terminals' | 'agents';

// Which rail mode a route belongs to. The universal session viewer /ai/:id
// follows the loaded session kind; until it loads, no mode is forced active.
export function modeForPath(pathname: string, sessionKind?: SessionKind | null): Mode | null {
  if (pathname.startsWith('/terminals')) return 'terminals';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/ai/')) {
    if (sessionKind === 'agent') return 'agents';
    if (sessionKind === 'terminal') return 'terminals';
    return null;
  }
  return 'tasks';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tickets/web test -- mode-for-path`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shell/mode-for-path.ts apps/web/src/components/shell/mode-for-path.test.ts
git commit -m "feat(web): modeForPath — derive the active workbench mode from the route"
```

---

## Task 7: Split sessions by kind + shared panel list

**Files:**
- Create: `apps/web/src/components/ai/select-sessions.ts`
- Test: `apps/web/src/components/ai/select-sessions.test.ts`
- Create: `apps/web/src/components/ai/session-list.tsx`

**Interfaces:**
- Consumes: `AiSession` (`apps/web/src/api/types.ts`), `buildSessionTree`/`SessionTreeNode` (`apps/web/src/components/ai/build-session-tree.ts`), `SessionKindGlyph`, `SessionStatusPill`, `formatAge`.
- Produces: `terminalsOf(sessions: AiSession[]): AiSession[]`, `agentsOf(sessions: AiSession[]): AiSession[]`; `SessionList({ sessions, workspaceName }: { sessions: AiSession[]; workspaceName: (id: number) => string })` — a compact tree list for the panel.

- [ ] **Step 1: Write the failing `select-sessions` test**

Create `apps/web/src/components/ai/select-sessions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AiSession } from '../../api/types';
import { agentsOf, terminalsOf } from './select-sessions';

const s = (id: number, kind: AiSession['kind']): AiSession =>
  ({ id, kind, title: `s${id}`, status: 'idle' } as AiSession);

describe('select-sessions', () => {
  const rows = [s(1, 'terminal'), s(2, 'agent'), s(3, 'terminal')];
  it('terminalsOf keeps only terminal sessions', () => {
    expect(terminalsOf(rows).map((r) => r.id)).toEqual([1, 3]);
  });
  it('agentsOf keeps only agent sessions', () => {
    expect(agentsOf(rows).map((r) => r.id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- select-sessions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `select-sessions`**

Create `apps/web/src/components/ai/select-sessions.ts`:

```ts
import type { AiSession } from '../../api/types';

export function terminalsOf(sessions: AiSession[]): AiSession[] {
  return sessions.filter((s) => s.kind === 'terminal');
}

export function agentsOf(sessions: AiSession[]): AiSession[] {
  return sessions.filter((s) => s.kind === 'agent');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tickets/web test -- select-sessions`
Expected: PASS.

- [ ] **Step 5: Extract the shared list component**

Create `apps/web/src/components/ai/session-list.tsx` by moving `SessionTreeRow` out of `ai-sessions-screen.tsx` and wrapping it. This is the compact panel list (narrower than the old table — no workspace/age columns; those stay in tooltips):

```tsx
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { AiSession } from '../../api/types';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { formatAge } from '../../utils/format-age';
import { buildSessionTree, type SessionTreeNode } from './build-session-tree';

// The mode-panel session list (Terminals / Agents). Dispatched children indent
// under their parent with a connector and a ticket chip.
export function SessionList({
  sessions,
  workspaceName,
}: {
  sessions: AiSession[];
  workspaceName: (id: number) => string;
}) {
  const tree = useMemo(() => buildSessionTree(sessions), [sessions]);
  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <SessionRow key={node.session.id} node={node} depth={0} workspaceName={workspaceName} />
      ))}
    </div>
  );
}

function SessionRow({
  node,
  depth,
  workspaceName,
}: {
  node: SessionTreeNode;
  depth: number;
  workspaceName: (id: number) => string;
}) {
  const { session } = node;
  return (
    <>
      <Link
        to="/ai/$sessionId"
        params={{ sessionId: String(session.id) }}
        title={`${workspaceName(session.workspaceId)} · ${formatAge(session.createdAt)}`}
        className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-inset"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {depth > 0 ? (
          <span aria-hidden className="font-mono text-meta text-ink-3">
            └
          </span>
        ) : null}
        <SessionKindGlyph kind={session.kind} />
        <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink">{session.title}</span>
        {session.ticketId != null ? (
          <span className="shrink-0 rounded-[4px] border border-hairline px-1 font-mono text-[10px] text-accent">
            →#{session.ticketId}
          </span>
        ) : null}
        <SessionStatusPill status={session.status} exitCode={session.exitCode} />
      </Link>
      {node.children.map((child) => (
        <SessionRow key={child.session.id} node={child} depth={depth + 1} workspaceName={workspaceName} />
      ))}
    </>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (`ai-sessions-screen.tsx` still compiles with its own copy of `SessionTreeRow` for now; Task 9 retires it.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ai/select-sessions.ts apps/web/src/components/ai/select-sessions.test.ts apps/web/src/components/ai/session-list.tsx
git commit -m "feat(web): kind selectors + shared SessionList for the mode panel"
```

---

## Task 8: Activity rail + mode panels

**Files:**
- Create: `apps/web/src/components/shell/activity-rail.tsx`
- Create: `apps/web/src/components/shell/tasks-panel.tsx`
- Create: `apps/web/src/components/shell/terminals-panel.tsx`
- Create: `apps/web/src/components/shell/agents-panel.tsx`
- Create: `apps/web/src/components/shell/mode-panel.tsx`

**Interfaces:**
- Consumes: `Mode` (Task 6), `SessionList`/`terminalsOf`/`agentsOf` (Task 7), `useAiSessions`, `useAiWorkspaces`, `useProjects`, `useProjectStats`, `NewSessionDialog`, `ActorMenu`, `NewProjectDialog`, `applyTheme`.
- Produces: `ActivityRail({ mode, onNavigate? })`; `ModePanel({ mode, activeProjectKey?, onNewTicket?, onNavigateSession })`. `TasksPanel` holds the projects nav lifted verbatim from today's `AppShell.sidebarContent` (search box, ＋New ticket, Home/All-tickets nav, PROJECTS list, ＋New project). `TerminalsPanel`/`AgentsPanel` render `SessionList` + a "＋ New …" button; `AgentsPanel` also links to `/agents/personas`.

- [ ] **Step 1: Build the activity rail**

Create `apps/web/src/components/shell/activity-rail.tsx`:

```tsx
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { applyTheme } from '../../utils/apply-theme';
import { cn } from '../../ui/cn';
import { ActorMenu } from './actor-menu';
import type { Mode } from './mode-for-path';

const ITEMS: { mode: Mode; to: string; glyph: string; label: string }[] = [
  { mode: 'tasks', to: '/', glyph: '▦', label: 'Tasks' },
  { mode: 'terminals', to: '/terminals', glyph: '▷_', label: 'Terminals' },
  { mode: 'agents', to: '/agents', glyph: '✳', label: 'Agents' },
];

// The always-visible mode switcher. Active mode is passed in (derived from the
// route), so deep links light the right icon.
export function ActivityRail({ mode, onNavigate }: { mode: Mode | null; onNavigate?: () => void }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');
  return (
    <aside className="flex w-12 flex-none flex-col items-center gap-1.5 border-r border-hairline bg-app py-3">
      <Link to="/" onClick={onNavigate} className="mb-2" aria-label="tickets home">
        <span aria-hidden className="block size-2.5 rounded-[2px] bg-accent" />
      </Link>
      {ITEMS.map((item) => (
        <Link
          key={item.mode}
          to={item.to}
          onClick={onNavigate}
          aria-label={item.label}
          title={item.label}
          className={cn(
            'flex size-9 items-center justify-center rounded-[9px] font-mono text-[13px]',
            mode === item.mode
              ? 'bg-accent text-on-accent'
              : 'text-ink-2 hover:bg-inset hover:text-ink',
          )}
        >
          {item.glyph}
        </Link>
      ))}
      <span className="flex-1" />
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          setTheme(next);
        }}
        className="flex size-9 items-center justify-center rounded-[9px] text-ink-2 hover:bg-inset"
      >
        ◐
      </button>
      <ActorMenu />
    </aside>
  );
}
```

- [ ] **Step 2: Extract the Tasks panel**

Create `apps/web/src/components/shell/tasks-panel.tsx` and move the **projects-nav portion** of today's `AppShell.sidebarContent` into it verbatim — the search button, ＋New ticket button, the `Home` / `All tickets` nav links (drop the old `/ai` "AI sessions" link — the rail replaces it), the `PROJECTS` label + project list (with `useProjects`/`useProjectStats`), the ＋New project button, and the `NewProjectDialog`. Keep the `Settings` link. Signature:

```tsx
export function TasksPanel({
  activeProjectKey,
  onNewTicket,
  onNavigate,
}: {
  activeProjectKey?: string;
  onNewTicket?: () => void;
  onNavigate?: () => void;
}) { /* moved markup; call onNavigate() inside link onClick for the mobile slide-over */ }
```

(Move the `useProjects`, `useProjectStats`, `statsByKey`, `allCount`, `creatingProject`, and `handleNewTicket` logic here from `AppShell`.)

- [ ] **Step 3: Build the Terminals and Agents panels**

Create `apps/web/src/components/shell/terminals-panel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useAiSessions } from '../../api/use-ai-sessions';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import { NewSessionDialog } from '../ai/new-session-dialog';
import { SessionList } from '../ai/session-list';
import { terminalsOf } from '../ai/select-sessions';

export function TerminalsPanel({
  onNavigateSession,
}: {
  onNavigateSession: (sessionId: number) => void;
}) {
  const sessions = useAiSessions();
  const workspaces = useAiWorkspaces();
  const [creating, setCreating] = useState(false);
  const workspaceName = useMemo(() => {
    const byId = new Map((workspaces.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workspaces.data]);
  const rows = terminalsOf(sessions.data ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">TERMINALS</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="font-sans text-meta text-accent hover:underline"
        >
          ＋ New
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-meta text-ink-3">No terminal sessions yet.</p>
      ) : (
        <SessionList sessions={rows} workspaceName={workspaceName} />
      )}
      <NewSessionDialog open={creating} onOpenChange={setCreating} onCreated={onNavigateSession} />
    </div>
  );
}
```

Create `apps/web/src/components/shell/agents-panel.tsx` — identical shape but `agentsOf`, label `AGENTS`, and a Personas link. Since `NewSessionDialog` currently only creates terminal sessions, the ＋New here navigates to the agent library to start one; wire the button to `Link to="/agents/personas"`:

```tsx
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useAiSessions } from '../../api/use-ai-sessions';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import { SessionList } from '../ai/session-list';
import { agentsOf } from '../ai/select-sessions';

export function AgentsPanel() {
  const sessions = useAiSessions();
  const workspaces = useAiWorkspaces();
  const workspaceName = useMemo(() => {
    const byId = new Map((workspaces.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workspaces.data]);
  const rows = agentsOf(sessions.data ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">AGENTS</span>
        <Link to="/agents/personas" className="font-sans text-meta text-accent hover:underline">
          Personas →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-meta text-ink-3">No agent sessions yet.</p>
      ) : (
        <SessionList sessions={rows} workspaceName={workspaceName} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Compose the ModePanel**

Create `apps/web/src/components/shell/mode-panel.tsx`:

```tsx
import type { Mode } from './mode-for-path';
import { AgentsPanel } from './agents-panel';
import { TasksPanel } from './tasks-panel';
import { TerminalsPanel } from './terminals-panel';

// The ~210px context panel beside the rail. Its contents follow the active mode.
export function ModePanel({
  mode,
  activeProjectKey,
  onNewTicket,
  onNavigate,
  onNavigateSession,
}: {
  mode: Mode | null;
  activeProjectKey?: string;
  onNewTicket?: () => void;
  onNavigate?: () => void;
  onNavigateSession: (sessionId: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3.5">
      {mode === 'terminals' ? (
        <TerminalsPanel onNavigateSession={onNavigateSession} />
      ) : mode === 'agents' ? (
        <AgentsPanel />
      ) : (
        <TasksPanel activeProjectKey={activeProjectKey} onNewTicket={onNewTicket} onNavigate={onNavigate} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (Not yet mounted — `AppShell` still renders its old sidebar; Task 9 swaps it in.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shell/activity-rail.tsx apps/web/src/components/shell/tasks-panel.tsx apps/web/src/components/shell/terminals-panel.tsx apps/web/src/components/shell/agents-panel.tsx apps/web/src/components/shell/mode-panel.tsx
git commit -m "feat(web): activity rail + mode panels (tasks/terminals/agents)"
```

---

## Task 9: Recompose AppShell + routes

**Files:**
- Modify: `apps/web/src/components/shell/app-shell.tsx`
- Create: `apps/web/src/routes/terminals-route.tsx`, `apps/web/src/routes/agents-route.tsx`
- Modify/rename: `apps/web/src/routes/ai-agents-route.tsx` → mount at `/agents/personas`; `apps/web/src/routes/ai-agent-route.tsx` → `/agents/personas/$agentId`
- Modify: `apps/web/src/routes/ai-route.tsx` → redirect `/ai` → `/terminals`
- Modify: the router registration file (where routes are assembled into the tree)
- Modify: `apps/web/src/components/ai/ai-sessions-screen.tsx` (retire) and any links to `/ai`/`/ai/agents`

**Interfaces:**
- Consumes: `ActivityRail`, `ModePanel` (Task 8), `modeForPath` (Task 6), `useAiSessions`, `useParams`/`useRouterState`.
- Produces: the new two-column shell; routes `/terminals`, `/agents`, `/agents/personas[/$agentId]`, `/ai` redirect.

- [ ] **Step 1: Recompose AppShell**

Rewrite `apps/web/src/components/shell/app-shell.tsx` to render the rail + panel + main, deriving the mode from the route. Replace the whole component with:

```tsx
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { useAiSessions } from '../../api/use-ai-sessions';
import { ActivityRail } from './activity-rail';
import { ModePanel } from './mode-panel';
import { modeForPath } from './mode-for-path';

export function AppShell({
  activeProjectKey,
  onNewTicket,
  children,
}: {
  activeProjectKey?: string;
  onNewTicket?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { sessionId?: string };
  const sessions = useAiSessions();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // For /ai/:id the mode follows the loaded session kind.
  const sessionKind =
    params.sessionId != null
      ? (sessions.data ?? []).find((s) => s.id === Number(params.sessionId))?.kind ?? null
      : null;
  const mode = modeForPath(pathname, sessionKind);

  const onNavigateSession = (sessionId: number) => {
    setMobileNavOpen(false);
    void navigate({ to: '/ai/$sessionId', params: { sessionId: String(sessionId) } });
  };

  const panel = (
    <ModePanel
      mode={mode}
      activeProjectKey={activeProjectKey}
      onNewTicket={onNewTicket}
      onNavigate={() => setMobileNavOpen(false)}
      onNavigateSession={onNavigateSession}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-app font-sans text-ink md:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-hairline bg-app px-2 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-[8px] text-[17px] text-ink-2 hover:bg-inset"
        >
          ☰
        </button>
        <span aria-hidden className="size-2.25 rounded-[2px] bg-accent" />
        <span className="font-mono text-[15px] font-semibold text-ink">tickets</span>
      </div>

      {/* Desktop: rail + panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <div className="flex w-56 flex-none flex-col overflow-y-auto border-r border-hairline">{panel}</div>
      </div>

      {/* Mobile slide-over: rail row on top + panel */}
      {mobileNavOpen ? (
        <div className="md:hidden">
          <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileNavOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 bg-app shadow-lg">
            <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
            <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
          </aside>
        </div>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Add the list routes**

Create `apps/web/src/routes/terminals-route.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

// The list lives in the mode panel; the main area is a hint until a session is
// opened via /ai/$sessionId.
function TerminalsPage() {
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center px-6">
        <p className="font-sans text-ui text-ink-3">
          Pick a terminal on the left, or start a new one.
        </p>
      </div>
    </AppShell>
  );
}

export const terminalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminals',
  component: TerminalsPage,
});
```

Create `apps/web/src/routes/agents-route.tsx` — same shape, `path: '/agents'`, copy reading "Pick an agent session on the left, or dispatch one from a ticket."

- [ ] **Step 3: Move the personas routes + redirect `/ai`**

- In `apps/web/src/routes/ai-agents-route.tsx`, change `path: '/ai/agents'` → `path: '/agents/personas'` (keep the component `AgentLibraryScreen`).
- In `apps/web/src/routes/ai-agent-route.tsx`, change `path: '/ai/agents/$agentId'` → `path: '/agents/personas/$agentId'`.
- Replace `apps/web/src/routes/ai-route.tsx` with a redirect:

```tsx
import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './root-route';

export const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  beforeLoad: () => {
    throw redirect({ to: '/terminals' });
  },
});
```

- [ ] **Step 4: Register the new routes**

Find where routes are assembled (search for `aiRoute` and `aiAgentsRoute` in `apps/web/src/routes` / the router file). Add `terminalsRoute` and `agentsRoute` to the route tree alongside the others, and ensure the renamed `aiAgentsRoute`/`aiAgentRoute` are still registered.

Run: `pnpm dlx tsx --version >/dev/null 2>&1; grep -rl "aiAgentsRoute" apps/web/src` to locate the registration.

- [ ] **Step 5: Retire `ai-sessions-screen.tsx` and fix stale links**

- Update `apps/web/src/components/ai/ticket-dispatch.tsx`: the "sessions" links stay on `/ai/$sessionId` (unchanged). No `/ai` list link there.
- Update `apps/web/src/components/ai/agent-session-screen.tsx`: the `← sessions` back button navigates `{ to: '/agents' }` (was `/ai`).
- Update `apps/web/src/components/ai/ai-session-screen.tsx`: its back button navigates `{ to: '/terminals' }`.
- Update `apps/web/src/components/ai/agent-library-screen.tsx` and `agent-profile-screen.tsx`: any `to="/ai/agents"` → `to="/agents/personas"`; `to="/ai/agents/$agentId"` → `to="/agents/personas/$agentId"`.
- Delete `apps/web/src/components/ai/ai-sessions-screen.tsx` (its list logic now lives in the panels + `session-list.tsx`). Remove its now-unused imports of `buildSessionTree` there.

Run: `grep -rn "to=\"/ai\"\|to='/ai'\|/ai/agents\|ai-sessions-screen" apps/web/src` and resolve every hit.

- [ ] **Step 6: Typecheck + build + full web suite**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm build`
Expected: PASS. Fix any router-type errors (TanStack regenerates the route union from registered routes).

- [ ] **Step 7: Manual smoke (dev stack)**

At http://localhost:4720: the rail shows ▦/▷_/✳; clicking each swaps the panel (projects / terminal list / agent list); opening a terminal keeps ▷_ lit, an agent session keeps ✳ lit; ＋New terminal in the panel starts one and navigates to it; `/ai` redirects to `/terminals`; Personas link reaches the library at `/agents/personas`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/shell/app-shell.tsx apps/web/src/routes/ apps/web/src/components/ai/
git rm apps/web/src/components/ai/ai-sessions-screen.tsx
git commit -m "feat(web): workbench shell — activity rail + mode panel; split terminal/agent routes"
```

---

## Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full repo checks**

Run: `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm --filter @tickets/db test && pnpm build`
Expected: all green. Web test count = 116 baseline + new (agent-models, derive-usage, context-meter, prompt-composer, mode-for-path, select-sessions). API unchanged except the 3 new map-sdk-message cases.

- [ ] **Step 2: Responsive smoke**

At http://localhost:4720, narrow the window below `md`: the ☰ slide-over shows the rail row + panel; selecting a mode and a session both work and close the slide-over.

- [ ] **Step 3: Commit any lint fixups**

```bash
git add -A && git commit -m "chore(web): AI sessions v2 verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** tweak 1 → Task 4; tweak 2 → Tasks 1–3, 5; tweaks 3+5 → Tasks 7–9 (split lists in panel); tweak 4 → Task 8 (rail); shell routes/mobile → Task 9. Backend `usage` gap → Task 1. Tweak 6 (profiles) is out of scope (own spec) per the design.
- **Type consistency:** `usage` shape identical in `apps/api/src/ai/types.ts` and `apps/web/src/api/types.ts`; `deriveUsage` return `{ contextTokens, tokensOut, cacheReadTokens }` consumed unchanged by `ContextMeter` and Task 5; `Mode` from Task 6 consumed by Tasks 8–9; `terminalsOf`/`agentsOf` from Task 7 consumed by Task 8.
- **Assumption to verify during Task 1:** the SDK result message exposes `usage.input_tokens` / `output_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens`. The mapper reads them defensively (all optional, default 0), so a field-name drift degrades to 0 rather than crashing — confirm against `@anthropic-ai/claude-agent-sdk` types when implementing.
