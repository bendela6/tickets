# Agent reports

`POST /api/agents` · `GET /api/agents`

What each agent working on the plans (the planner, the builder, every worker
the builder dispatches) last said it is doing, kept by tickets in place of the
task viewer's `/agents`. One report per agent, written over by its next word;
a report goes a week after the agent last spoke.

A word is not a command: an agent speaks at every step and the builder every
20 seconds, which would fill the history with nothing. These routes write
`core.agent_reports` directly and write no command, event or outbox row.

**Source:** [`apps/api/src/routes/agents.routes.ts`](../../apps/api/src/routes/agents.routes.ts), kept in
[`apps/api/src/agents/reports.ts`](../../apps/api/src/agents/reports.ts)

## Say something

`POST /api/agents`

The task viewer's body today:

```ts
{
  name: string;          // worker-tk-7, planner, builder
  state: AgentState | 'clear';
  role?: AgentRole;      // left out: the name's for planner and builder, else worker
  item?: string | null;  // an item's key; '' or null is none
  text?: string | null;  // what it is doing now, in a few words
}
```

| Field | Rule |
| ----- | ---- |
| `name` | Trimmed; lowercase letters, digits, dots and dashes, starting with a letter or a digit, at most 48 characters. |
| `state` | One of the [states](#types); `clear` forgets the agent. |
| `item` | Trimmed; a key in any of its forms: `TIX-90`, `TK/E14`, `TK-80.3`, `TK-11.2.1`. A key no tickets item has (a plans id such as `TK-7.2` while the plans live in `tasks/*.json`) is kept all the same, linked to nothing. |
| `text` | Trimmed, and cut to its first 300 characters rather than refused. |

The report keeps `since` while the agent's state and item stay what they
were, and moves it when either changes. Every word first drops the reports a
week old.

`200 OK` — `{ data: AgentReport }`, or `{ data: null }` for `clear`.

## Read them

`GET /api/agents`

`200 OK` — `{ data: AgentReport[] }`: every report from the past week, the
planner first, then the builder, then the workers by `since`. A report a week
old is never answered, even when no word has come since to drop it.

## Errors

| Status | When |
| ------ | ---- |
| `400` | The body breaks a rule above, e.g. `state: a state is listening, working, done, failed, abandoned, stopped, or clear`. |

## Database

- **Reads:** `core.agent_reports`, `records.items` (an item by its key)
- **Writes:** `core.agent_reports`

## Types

```ts
type AgentRole = 'planner' | 'builder' | 'worker';
type AgentState = 'listening' | 'working' | 'done' | 'failed' | 'abandoned' | 'stopped';

type AgentReport = {
  name: string;
  role: AgentRole;
  state: AgentState;     // what it last said it is
  item: string | null;   // the item as the agent named it
  itemId: number | null; // the tickets item with that key; null when none has it
  text: string;          // at most 300 characters
  at: string;            // ISO: when it last said anything
  since: string;         // ISO: since when its state and its item are what they are
};
```
