import * as v from 'valibot';
import { and, eq, getTableColumns, gte, lt, sql } from 'drizzle-orm';
import type { Db, DbExecutor } from '@tickets/db';
import { AGENT_ROLES, AGENT_STATES, agentReports, items } from '@tickets/db';

// What each agent working on the plans last said it is doing (TK-84.1), in
// place of the task viewer's `/agents`: one row per agent (core.agent_reports),
// written over by its next word. Not a command: an agent speaks at every step
// and the builder every 20 seconds, which would fill the history with
// nothing, so these write the table directly and leave events, commands and
// the outbox alone.

export type AgentRole = (typeof AGENT_ROLES)[number];
export type AgentState = (typeof AGENT_STATES)[number];

export const TEXT_MAX_LENGTH = 300;
// A word a week old goes: on every word, and no read answers one.
export const KEPT_FOR_MS = 7 * 24 * 60 * 60_000;

// The task viewer's rules for a name, so every agent that spoke to it can
// speak here: worker-tk-7, planner, builder.
const NAME = /^[a-z0-9][a-z0-9.-]{0,47}$/;
// An item's key in any project (TIX-90, TK/E14, TK-80.3, TK-11.2.1), which is
// also how the plans write their ids (TK-7.2, TK/E4) while they live in
// tasks/*.json.
const ITEM = /^[^\s/]+(?:-\d+(?:\.\d+)*|\/E\d+)$/;

// The body the task viewer's `POST /agents` takes today: `{name, state, role?,
// item?, text?}`. State `clear` forgets the agent, as there.
export const agentWordInput = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.regex(NAME, 'a name is lowercase letters, digits, dots and dashes, like worker-tk-7'),
  ),
  state: v.picklist(
    [...AGENT_STATES, 'clear'] as const,
    `a state is ${AGENT_STATES.join(', ')}, or clear`,
  ),
  // Left out, it is the name's for the planner and the builder, else worker.
  role: v.optional(v.picklist(AGENT_ROLES, `a role is ${AGENT_ROLES.join(', ')}`)),
  // An item's key; empty or null is none.
  item: v.optional(
    v.nullable(
      v.pipe(
        v.string(),
        v.trim(),
        v.check((key) => key === '' || ITEM.test(key), 'an item is a key: TK-7, TK-7.2 or TK/E4'),
      ),
    ),
  ),
  // Longer words are cut to the first 300 characters, as the viewer does,
  // rather than lose the word.
  text: v.optional(
    v.nullable(
      v.pipe(
        v.string(),
        v.trim(),
        v.transform((text) => text.slice(0, TEXT_MAX_LENGTH).trimEnd()),
      ),
    ),
  ),
});
export type AgentWord = v.InferOutput<typeof agentWordInput>;

// One agent's last word, as the api answers it.
export type AgentReport = {
  name: string;
  role: AgentRole;
  state: AgentState;
  // The item as the agent named it.
  item: string | null;
  // The tickets item with that key; null when no item has it (a plans id).
  itemId: number | null;
  text: string;
  // When it last said anything (ISO).
  at: string;
  // Since when its state and its item have been what they are (ISO).
  since: string;
};

const keptFrom = (now: Date) => new Date(now.getTime() - KEPT_FOR_MS);

const roleOf = (word: AgentWord): AgentRole =>
  word.role ?? (word.name === 'planner' || word.name === 'builder' ? word.name : 'worker');

// Keeps an agent's word, written over its last; `since` stays while its state
// and its item stay the same. Answers the report, or null for `clear`.
export async function saveReport(db: Db, word: AgentWord, now: Date): Promise<AgentReport | null> {
  return db.transaction(async (tx) => {
    await tx.delete(agentReports).where(lt(agentReports.at, keptFrom(now)));
    if (word.state === 'clear') {
      await tx.delete(agentReports).where(eq(agentReports.name, word.name));
      return null;
    }
    const row = {
      name: word.name,
      role: roleOf(word),
      state: word.state,
      item: word.item || null,
      text: word.text ?? '',
      at: now,
      since: now,
    };
    await tx
      .insert(agentReports)
      .values(row)
      .onConflictDoUpdate({
        target: agentReports.name,
        set: {
          role: row.role,
          state: row.state,
          item: row.item,
          text: row.text,
          at: row.at,
          // agent_reports is the row there, excluded the word just sent
          since: sql.raw(
            'CASE WHEN agent_reports.state = excluded.state AND agent_reports.item IS NOT DISTINCT FROM excluded.item ' +
              'THEN agent_reports.since ELSE excluded.since END',
          ),
        },
      });
    const [report] = await listReports(tx, now, word.name);
    return report!;
  });
}

const RANK: Record<string, number> = { planner: 0, builder: 1, worker: 2 };

// Every agent's last word from the past week (or the one agent's): the
// planner, the builder, then the workers by when they took up what they are
// doing.
export async function listReports(db: DbExecutor, now: Date, name?: string): Promise<AgentReport[]> {
  const rows = await db
    .select({ ...getTableColumns(agentReports), itemId: items.id })
    .from(agentReports)
    .leftJoin(items, eq(items.key, agentReports.item))
    .where(and(gte(agentReports.at, keptFrom(now)), name === undefined ? undefined : eq(agentReports.name, name)));
  return rows
    .map((row) => ({
      name: row.name,
      role: row.role as AgentRole,
      state: row.state as AgentState,
      item: row.item,
      itemId: row.itemId,
      text: row.text,
      at: row.at.toISOString(),
      since: row.since.toISOString(),
    }))
    .sort(
      (a, b) =>
        (RANK[a.role] ?? 3) - (RANK[b.role] ?? 3) ||
        a.since.localeCompare(b.since) ||
        a.name.localeCompare(b.name),
    );
}
