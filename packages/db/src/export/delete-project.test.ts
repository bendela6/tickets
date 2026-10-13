import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { createDbClient, type Db } from '../client';
import {
  commands,
  commentReactions,
  comments,
  events,
  fields,
  itemActivity,
  itemLinks,
  itemTypeFields,
  itemTypes,
  itemValues,
  items,
  linkTypes,
  optionSets,
  options,
  outbox,
  projects,
  schemes,
  users,
  views,
} from '../schema';
import {
  assertMayDeleteFrom,
  createDeleteClient,
  deleteProjects,
  DeletionRefusedError,
  planDeletion,
  ProductionDatabaseError,
  type BackupFile,
  type DeletionPlan,
} from './delete-project';
import {
  exportProjects,
  PROJECT_TABLES,
  selectProjectRows,
  UnknownProjectError,
  type ProjectExport,
} from './export-project';
import { createReadOnlyClient, readOnlySnapshot } from './read-only-client';

// Four small projects in their own scheme, written into tickets_test:
//   A  what gets deleted: items (one the parent of another), values, a comment
//      thread, a reaction, a link inside A, events (one caused by another),
//      item activity, a command and an outbox row, a view
//   B, C  linked to each other, so neither can go alone
//   D  a bystander that must come through untouched
// Every key carries a random suffix so nothing collides with other test files.
const AT = '2026-03-01 10:00:00.123456+00';

describe('deleteProjects (requires a freshly migrated tickets_test)', () => {
  const suffix = randomUUID().slice(0, 8);
  const P = (letter: string) => `DEL${letter}${suffix.toUpperCase()}`;

  let db: Db;
  let writer: Sql;
  let reader: Sql;
  let deleter: Sql;
  const id: Record<string, number> = {};
  let backups: BackupFile[] = [];
  const projectIds: number[] = [];

  const plan = (selectors: string[], files: BackupFile[] = backups): Promise<DeletionPlan> =>
    readOnlySnapshot(reader, (tx) => planDeletion(tx, selectors, { backups: files }));
  const exportOf = async (prefix: string) =>
    ((await exportProjects(reader, [prefix])) as [ProjectExport])[0];
  const tableCounts = async () => {
    const out: Record<string, number> = {};
    for (const t of [
      ...PROJECT_TABLES,
      'core.users',
      'structure.schemes',
      'structure.item_types',
      'structure.item_type_fields',
      'structure.fields',
      'structure.option_sets',
      'structure.options',
      'structure.link_types',
    ]) {
      const [row] = await writer<{ n: number }[]>`SELECT count(*)::int AS n FROM ${writer(t)}`;
      out[t] = row!.n;
    }
    return out;
  };

  beforeAll(async () => {
    const client = createDbClient({ max: 1 });
    db = client.db;
    writer = client.sql;
    reader = createReadOnlyClient().sql;
    deleter = createDeleteClient().sql;

    const [alice] = await db
      .insert(users)
      .values({ name: `alice-${suffix}`, kind: 'human' })
      .returning();
    id.alice = alice!.id;
    const [scheme] = await db
      .insert(schemes)
      .values({ key: `delete-${suffix}`, name: 'Delete test' })
      .returning();
    id.scheme = scheme!.id;
    const [statusSet] = await db
      .insert(optionSets)
      .values({ schemeId: id.scheme, key: 'status', name: 'Status' })
      .returning();
    const [todo] = await db
      .insert(options)
      .values({
        optionSetId: statusSet!.id,
        value: 'todo',
        label: 'To do',
        position: 0,
        kind: 'todo',
      })
      .returning();
    id.todo = todo!.id;
    const fieldRows = await db
      .insert(fields)
      .values([
        { schemeId: id.scheme, key: 'title', label: 'Title', type: 'string' },
        {
          schemeId: id.scheme,
          key: 'status',
          label: 'Status',
          type: 'option',
          optionSetId: statusSet!.id,
        },
      ])
      .returning();
    [id.title, id.status] = fieldRows.map((f) => f.id) as [number, number];
    const [task] = await db
      .insert(itemTypes)
      .values({ schemeId: id.scheme, key: 'task', label: 'Task', position: 0 })
      .returning();
    id.task = task!.id;
    await db.insert(itemTypeFields).values([
      { itemTypeId: id.task, fieldId: id.title, position: 0 },
      { itemTypeId: id.task, fieldId: id.status, position: 1 },
    ]);
    const [relates] = await db
      .insert(linkTypes)
      .values({
        itemTypeId: id.task,
        key: 'relates',
        label: 'Relates to',
        inverseLabel: 'Relates to',
        directional: false,
        position: 0,
      })
      .returning();
    id.relates = relates!.id;

    const projectRows = await db
      .insert(projects)
      .values(
        ['A', 'B', 'C', 'D'].map((l) => ({
          key: `delete-${l.toLowerCase()}-${suffix}`,
          name: `Delete ${l}`,
          itemPrefix: P(l),
          schemeId: id.scheme!,
        })),
      )
      .returning();
    [id.A, id.B, id.C, id.D] = projectRows.map((p) => p.id) as [number, number, number, number];
    projectIds.push(...projectRows.map((p) => p.id));
    const [viewA] = await db
      .insert(views)
      .values([
        { projectId: id.A, name: 'A board', position: 0 },
        { projectId: id.D, name: 'D board', position: 0 },
      ])
      .returning();
    id.viewA = viewA!.id;

    const item = (projectId: number, number: number) => ({
      projectId,
      typeId: id.task!,
      number,
      key: `DEL${suffix}-${projectId}-${number}`,
      createdBy: id.alice!,
      createdAt: AT,
      updatedAt: AT,
    });
    const itemRows = await db
      .insert(items)
      .values([item(id.A, 1), item(id.A, 2), item(id.B, 1), item(id.C, 1), item(id.D, 1)])
      .returning();
    [id.a1, id.a2, id.b1, id.c1, id.d1] = itemRows.map((i) => i.id) as number[] as [
      number,
      number,
      number,
      number,
      number,
    ];
    await writer`UPDATE records.items SET parent_id = ${id.a1} WHERE id = ${id.a2}`;
    await db.insert(itemValues).values([
      ...(['a1', 'a2', 'b1', 'c1', 'd1'] as const).map((k) => ({
        itemId: id[k]!,
        fieldId: id.title!,
        valueText: `${k} title`,
      })),
      { itemId: id.a1, fieldId: id.status, optionId: id.todo },
      { itemId: id.d1, fieldId: id.status, optionId: id.todo },
    ]);
    const [c1] = await db
      .insert(comments)
      .values({ itemId: id.a1, authorId: id.alice, body: 'first', createdAt: AT })
      .returning();
    await db.insert(comments).values({
      itemId: id.a1,
      authorId: id.alice,
      body: 'reply',
      parentId: c1!.id,
      createdAt: AT,
    });
    await db
      .insert(comments)
      .values({ itemId: id.d1, authorId: id.alice, body: 'on d1', createdAt: AT });
    await db
      .insert(commentReactions)
      .values({ commentId: c1!.id, userId: id.alice, emoji: '+1', createdAt: AT });
    await db.insert(itemLinks).values([
      { linkTypeId: id.relates, sourceItemId: id.a1, targetItemId: id.a2, createdAt: AT },
      { linkTypeId: id.relates, sourceItemId: id.b1, targetItemId: id.c1, createdAt: AT },
    ]);

    const event = (
      aggregateType: string,
      aggregateId: number,
      seq: number,
      projectId: number | null,
    ) => {
      const correlationId = randomUUID();
      return {
        aggregateType,
        aggregateId,
        seq,
        kind: 'item.field_changed',
        version: 1,
        at: AT,
        projectId,
        payload: { fieldKey: 'title' },
        actorId: id.alice!,
        commandId: correlationId,
        correlationId,
      };
    };
    const eventRows = await db
      .insert(events)
      .values([
        event('item', id.a1, 1, id.A),
        event('item', id.a2, 1, id.A),
        event('view', id.viewA, 1, null),
        event('item', id.d1, 1, id.D),
      ])
      .returning();
    [id.evA1, id.evA2, id.evViewA, id.evD1] = eventRows.map((e) => e.id) as [
      number,
      number,
      number,
      number,
    ];
    await writer`UPDATE history.events SET caused_by = ${id.evA1} WHERE id = ${id.evA2}`;
    await db.insert(itemActivity).values([
      {
        itemId: id.a1,
        eventId: id.evA1,
        projectId: id.A,
        kind: 'item.field_changed',
        actorId: id.alice,
        at: AT,
        correlationId: eventRows[0]!.correlationId,
        summary: {},
      },
      {
        itemId: id.d1,
        eventId: id.evD1,
        projectId: id.D,
        kind: 'item.field_changed',
        actorId: id.alice,
        at: AT,
        correlationId: eventRows[3]!.correlationId,
        summary: {},
      },
    ]);
    await db.insert(commands).values([
      {
        id: eventRows[0]!.commandId,
        aggregateType: 'item',
        aggregateId: id.a1,
        actorId: id.alice,
        at: AT,
      },
      {
        id: eventRows[3]!.commandId,
        aggregateType: 'item',
        aggregateId: id.d1,
        actorId: id.alice,
        at: AT,
      },
    ]);
    await db.insert(outbox).values([{ eventId: id.evA1 }, { eventId: id.evD1 }]);

    const exported = await exportProjects(reader, [P('A'), P('B'), P('C')]);
    backups = exported.map((e) => ({ file: `${e.project.itemPrefix}.json`, export: e }));
  }, 60_000);

  afterAll(async () => {
    // whatever a failing test left behind, children first
    if (writer && projectIds.length) {
      const itemIds = writer`SELECT id FROM records.items WHERE project_id IN ${writer(projectIds)}`;
      const eventIds = () => writer`SELECT id FROM history.events WHERE actor_id = ${id.alice!}`;
      await writer`DELETE FROM history.outbox WHERE event_id IN (${eventIds()})`;
      await writer`DELETE FROM history.item_activity WHERE actor_id = ${id.alice!}`;
      await writer`DELETE FROM history.commands WHERE actor_id = ${id.alice!}`;
      await writer`UPDATE history.events SET caused_by = NULL WHERE actor_id = ${id.alice!}`;
      await writer`DELETE FROM history.events WHERE actor_id = ${id.alice!}`;
      await writer`DELETE FROM records.comment_reactions WHERE user_id = ${id.alice!}`;
      await writer`UPDATE records.comments SET parent_id = NULL WHERE author_id = ${id.alice!}`;
      await writer`DELETE FROM records.comments WHERE author_id = ${id.alice!}`;
      await writer`DELETE FROM records.item_links WHERE link_type_id = ${id.relates!}`;
      await writer`DELETE FROM records.item_values WHERE field_id IN (${id.title!}, ${id.status!})`;
      await writer`UPDATE records.items SET parent_id = NULL WHERE id IN (${itemIds})`;
      await writer`DELETE FROM records.items WHERE project_id IN ${writer(projectIds)}`;
      await writer`DELETE FROM structure.views WHERE project_id IN ${writer(projectIds)}`;
      await writer`DELETE FROM core.projects WHERE id IN ${writer(projectIds)}`;
    }
    if (writer && id.scheme) {
      await writer`DELETE FROM structure.link_types WHERE id = ${id.relates!}`;
      await writer`DELETE FROM structure.item_type_fields WHERE item_type_id = ${id.task!}`;
      await writer`DELETE FROM structure.item_types WHERE scheme_id = ${id.scheme}`;
      await writer`DELETE FROM structure.fields WHERE scheme_id = ${id.scheme}`;
      await writer`DELETE FROM structure.options WHERE option_set_id IN (SELECT id FROM structure.option_sets WHERE scheme_id = ${id.scheme})`;
      await writer`DELETE FROM structure.option_sets WHERE scheme_id = ${id.scheme}`;
      await writer`DELETE FROM structure.schemes WHERE id = ${id.scheme}`;
      await writer`DELETE FROM core.users WHERE id = ${id.alice!}`;
    }
    await deleter?.end();
    await reader?.end();
    await writer?.end();
  });

  it('refuses the production database unless told otherwise', () => {
    expect(() => assertMayDeleteFrom('tickets')).toThrow(ProductionDatabaseError);
    expect(() => assertMayDeleteFrom('tickets', { allowProduction: true })).not.toThrow();
    expect(() => assertMayDeleteFrom('tickets_dev')).not.toThrow();
  });

  it('plans to delete exactly the rows the backup holds, and nothing shared', async () => {
    const p = await plan([P('A').toLowerCase()]);
    const backupA = backups[0]!.export;
    expect(p.database).toBe('tickets_test');
    expect(p.problems).toEqual([]);
    expect(p.projects.map((x) => x.id)).toEqual([id.A]);
    for (const t of PROJECT_TABLES) expect(p.totals[t]).toBe(backupA.counts[t]);
    expect(p.totals).toMatchObject({
      'core.projects': 1,
      'structure.views': 1,
      'records.items': 2,
      'records.item_values': 3,
      'records.comments': 2,
      'records.comment_reactions': 1,
      'records.item_links': 1,
      'history.events': 3, // a1's, a2's, and the view's
      'history.item_activity': 1,
      'history.commands': 1,
      'history.outbox': 1,
    });
    expect(p.backups).toEqual([
      expect.objectContaining({
        project: P('A'),
        matched: 17,
        rows: 17,
        missing: {},
        changed: {},
        gone: 0,
      }),
    ]);
  });

  it('refuses a project linked to one that is not being deleted, but not the two together', async () => {
    const alone = await plan([P('B')]);
    expect(alone.problems).toEqual([
      expect.stringMatching(new RegExp(`joins ${P('B')}-1 to ${P('C')}-1`)),
    ]);
    const together = await plan([P('B'), P('C')]);
    expect(together.problems).toEqual([]);
    expect(together.totals['records.item_links']).toBe(1); // counted once
    expect(together.counts[P('B')]!['records.item_links']).toBe(1);
    expect(together.counts[P('C')]!['records.item_links']).toBe(1);
  });

  it('refuses when a row that stays points at a row to delete', async () => {
    await writer`UPDATE records.items SET parent_id = ${id.a1!} WHERE id = ${id.d1!}`;
    await writer`UPDATE history.events SET caused_by = ${id.evA1!} WHERE id = ${id.evD1!}`;
    try {
      const p = await plan([P('A')]);
      expect(p.problems).toEqual([
        `1 row(s) of history.events that stay would point at deleted history.events rows (history.events.caused_by = ${id.evA1}; events_caused_by_events_id_fk)`,
        `1 row(s) of records.items that stay would point at deleted records.items rows (records.items.parent_id = ${id.a1}; items_parent_id_items_id_fk)`,
      ]);
    } finally {
      await writer`UPDATE records.items SET parent_id = NULL WHERE id = ${id.d1!}`;
      await writer`UPDATE history.events SET caused_by = NULL WHERE id = ${id.evD1!}`;
    }
  });

  it('refuses an item whose parent is in a project not being deleted', async () => {
    await writer`UPDATE records.items SET parent_id = ${id.d1!} WHERE id = ${id.a1!}`;
    try {
      const p = await plan([P('A')]);
      expect(p.problems).toContainEqual(
        `${P('A')}-1's parent is ${P('D')}-1, an item of a project not being deleted`,
      );
    } finally {
      await writer`UPDATE records.items SET parent_id = NULL WHERE id = ${id.a1!}`;
    }
  });

  it("refuses without a backup, or with one that doesn't hold every row unchanged", async () => {
    expect((await plan([P('A')], [])).problems).toEqual([
      expect.stringMatching(/no backup file names it/),
    ]);

    const edited = structuredClone(backups[0]!.export);
    const dropped = edited.rows['records.comments'].pop()!;
    const value = edited.rows['records.item_values'][0]!;
    value.value_text = 'not what the database holds';
    const p = await plan([P('A')], [{ file: 'edited.json', export: edited }]);
    expect(p.problems).toHaveLength(1);
    expect(p.problems[0]).toContain(`not in it: records.comments ${String(dropped.id)}`);
    expect(p.problems[0]).toContain(`changed since: records.item_values ${String(value.id)}`);
    expect(p.backups[0]).toMatchObject({ matched: 15, rows: 17 });

    await expect(
      deleteProjects(deleter, [P('A')], { backups: [{ file: 'edited.json', export: edited }] }),
    ).rejects.toBeInstanceOf(DeletionRefusedError);
    expect((await selectProjectRows_(id.A!))['records.items']).toHaveLength(2); // nothing deleted
  });

  it('refuses a project nobody named right', async () => {
    await expect(plan(['NO-SUCH-PROJECT'])).rejects.toBeInstanceOf(UnknownProjectError);
  });

  it('deletes the project with every row it owns, and nothing else', async () => {
    const before = await tableCounts();
    const dBefore = await exportOf(P('D'));
    const bBefore = await exportOf(P('B'));

    const { plan: p, deleted } = await deleteProjects(deleter, [P('A')], { backups });
    expect(deleted).toEqual(p.totals);

    // A is gone, every row of it
    await expect(plan([P('A')])).rejects.toBeInstanceOf(UnknownProjectError);
    const left = await selectProjectRows_(id.A!);
    for (const t of PROJECT_TABLES) expect(left[t]).toEqual([]);

    // each table lost exactly A's rows; the shared structure lost nothing
    const after = await tableCounts();
    for (const [t, n] of Object.entries(before))
      expect([t, after[t]]).toEqual([t, n - (deleted[t as keyof typeof deleted] ?? 0)]);

    // the bystanders are row for row what they were
    expect((await exportOf(P('D'))).rows).toEqual(dBefore.rows);
    expect((await exportOf(P('B'))).rows).toEqual(bBefore.rows);
  });

  it('deletes two linked projects together', async () => {
    const { deleted } = await deleteProjects(deleter, [P('B'), P('C')], { backups });
    expect(deleted['core.projects']).toBe(2);
    expect(deleted['records.item_links']).toBe(1);
    await expect(plan([P('C')])).rejects.toBeInstanceOf(UnknownProjectError);
    expect((await exportOf(P('D'))).counts['records.items']).toBe(1);
  });

  // selectProjectRows wants a transaction
  async function selectProjectRows_(projectId: number) {
    return readOnlySnapshot(reader, (tx) => selectProjectRows(tx, projectId));
  }
});
