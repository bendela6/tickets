# Agent reports

`POST /api/agents` · `GET /api/agents` · `DELETE /api/agents/:name`

What each agent working on the plans (the planner, the builder, every worker
the builder dispatches) last said it is doing, kept by tickets in place of the
task viewer's `/agents`. One report per agent, written over by its next word;
a report goes a week after the agent last spoke. Each report carries what
the screens show for it now (`shown`), worked out here once, by the task
viewer's rules, so no screen works it out for itself.

A word is not a command: an agent speaks at every step and the builder every
20 seconds, which would fill the history with nothing. These routes write
`core.agent_reports` directly and write no command, event or outbox row.

**Source:** [`apps/api/src/routes/agents.routes.ts`](../../apps/api/src/routes/agents.routes.ts), kept in
[`apps/api/src/agents/reports.ts`](../../apps/api/src/agents/reports.ts), shown by
[`apps/api/src/agents/shown.ts`](../../apps/api/src/agents/shown.ts)

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
old is never answered, even when no word has come since to drop it. A report
the screens show no more (`shown: null`) is answered all the same.

## What the screens show

`shown` is worked out from the report's role, its state, how long ago its last
word was (`at`), and whether its item is done: a tickets item whose workflow
status has kind `done` (`dropped`, a cancelled item, is not done). An item no
tickets item has, such as a plans id, is never done.

| Role | Said | Shown |
| ---- | ---- | ----- |
| planner, builder | `listening`, under a minute ago | `listening` |
| planner, builder | `working`, under 30 minutes ago | `working` |
| planner, builder | anything else | `not-running` |
| worker | `working` or `listening`, its item done | `finished` for 15 minutes from its last word, then null |
| worker | `working` or `listening`, under 30 minutes ago | `working` |
| worker | `working` or `listening`, 30 minutes ago or more | `quiet` (the viewer's "abandoned?"), dismissible |
| worker | `failed` or `abandoned` | the same, dismissible, until its item is done (then null) or it is dismissed |
| worker | `done` | `finished`, dismissible, for 15 minutes from its last word, then null |
| worker | `stopped` | `stopped`, dismissible, for 15 minutes from its last word, then null |

## Dismiss one

`DELETE /api/agents/:name`

Forgets the agent's report, as the viewer's × does: `204 No Content`. Any
agent can be dismissed; the screens offer it where `shown.dismissible` is
true.

## Errors

| Status | When |
| ------ | ---- |
| `400` | The body breaks a rule above, e.g. `state: a state is listening, working, done, failed, abandoned, stopped, or clear`. |
| `404` | `DELETE`: `no agent <name>` |

## Database

- **Reads:** `core.agent_reports`, `records.items` (an item by its key), and its
  workflow status: `records.item_values`, `structure.fields`, `structure.options`
- **Writes:** `core.agent_reports`

## Types

```ts
type AgentRole = 'planner' | 'builder' | 'worker';
type AgentState = 'listening' | 'working' | 'done' | 'failed' | 'abandoned' | 'stopped';

type Shown = {
  state: ShownState;
  dismissible: boolean;  // whether a screen offers to dismiss it (DELETE)
};
type ShownState =
  | 'listening' | 'working' | 'not-running'  // the planner, the builder
  | 'working' | 'quiet' | 'finished' | 'failed' | 'abandoned' | 'stopped';  // a worker

type AgentReport = {
  name: string;
  role: AgentRole;
  state: AgentState;     // what it last said it is
  shown: Shown | null;   // what the screens show for it now; null: nothing
  item: string | null;   // the item as the agent named it
  itemId: number | null; // the tickets item with that key; null when none has it
  text: string;          // at most 300 characters
  at: string;            // ISO: when it last said anything
  since: string;         // ISO: since when its state and its item are what they are
};
```
