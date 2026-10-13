import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray, sql as raw } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { createDbClient, type Db } from '../client';
import {
  commands,
  comments,
  commentReactions,
  events,
  fields,
  itemActivity,
  itemLinks,
  itemTypeChildTypes,
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
  exportProjects,
  PROJECT_TABLES,
  UnknownProjectError,
  type ProjectExport,
} from './export-project';
import { createReadOnlyClient, readOnlySnapshot } from './read-only-client';
import { parsePgTimestamp, summarizeExport } from './summarize-export';

// Two small projects, A and B, in their own scheme, written into
// tickets_test and removed again afterwards. Every key carries a random
// suffix so nothing here can collide with another test file's rows.
const OLD = '2026-01-01 00:00:00.123456+00';
const RECENT = '2026-09-30 12:00:00.654321+00';
const NOW = Date.parse('2026-10-13T00:00:00Z');

describe('exportProjects (requires a freshly migrated tickets_test)', () => {
  const suffix = randomUUID().slice(0, 8);
  const keyA = `export-a-${suffix}`;
  const prefixA = `EXA${suffix.toUpperCase()}`;
  const keyB = `export-b-${suffix}`;

  let db: Db;
  let writer: Sql;
  let reader: Sql;
  let exp: ProjectExport;
  // what the fixture created, by name, for assertions and clean-up
  const id: Record<string, number> = {};
  const name = (keys: string[], rows: { id: number }[]) =>
    keys.forEach((k, i) => {
      id[k] = rows[i]!.id;
    });
  const created = {
    users: [] as number[],
    items: [] as number[],
    events: [] as number[],
    comments: [] as number[],
    links: [] as number[],
    values: [] as number[],
    views: [] as number[],
    projects: [] as number[],
    types: [] as number[],
    fields: [] as number[],
    sets: [] as number[],
    options: [] as number[],
    linkTypes: [] as number[],
    commands: [] as string[],
  };

  beforeAll(async () => {
    const client = createDbClient({ max: 1 });
    db = client.db;
    writer = client.sql;
    reader = createReadOnlyClient().sql;

    const userRows = await db
      .insert(users)
      .values([
        { name: `alice-${suffix}`, kind: 'human' },
        { name: `bot-${suffix}`, kind: 'agent' },
        { name: `carol-${suffix}`, kind: 'human' }, // only named in an event payload
        { name: `dave-${suffix}`, kind: 'human' }, // never referenced
      ])
      .returning();
    name(['alice', 'bot', 'carol', 'dave'], userRows);
    created.users.push(...userRows.map((u) => u.id));

    const [scheme] = await db
      .insert(schemes)
      .values({ key: `export-${suffix}`, name: 'Export test' })
      .returning();
    id.scheme = scheme!.id;

    const setRows = await db
      .insert(optionSets)
      .values([
        { schemeId: id.scheme, key: 'status', name: 'Status' },
        { schemeId: id.scheme, key: 'priority', name: 'Priority' },
        { schemeId: id.scheme, key: 'unused', name: 'Unused' },
      ])
      .returning();
    name(['statusSet', 'prioritySet', 'unusedSet'], setRows);
    created.sets.push(...setRows.map((s) => s.id));

    const optionRows = await db
      .insert(options)
      .values([
        {
          optionSetId: id.statusSet!,
          value: 'backlog',
          label: 'Backlog',
          position: 0,
          kind: 'todo',
        },
        { optionSetId: id.statusSet!, value: 'doing', label: 'Doing', position: 1, kind: 'active' },
        {
          optionSetId: id.statusSet!,
          value: 'blocked',
          label: 'Blocked',
          position: 2,
          kind: 'blocked',
        },
        { optionSetId: id.statusSet!, value: 'done', label: 'Done', position: 3, kind: 'done' },
        {
          optionSetId: id.statusSet!,
          value: 'cancelled',
          label: 'Cancelled',
          position: 4,
          kind: 'dropped',
        },
        { optionSetId: id.prioritySet!, value: 'high', label: 'High', position: 0 },
        { optionSetId: id.unusedSet!, value: 'x', label: 'X', position: 0 },
      ])
      .returning();
    name(['backlog', 'doing', 'blocked', 'done', 'cancelled', 'high', 'x'], optionRows);
    created.options.push(...optionRows.map((o) => o.id));

    const fieldRows = await db
      .insert(fields)
      .values([
        { schemeId: id.scheme, key: 'title', label: 'Title', type: 'string' },
        {
          schemeId: id.scheme,
          key: 'status',
          label: 'Status',
          type: 'option',
          optionSetId: id.statusSet!,
        },
        { schemeId: id.scheme, key: 'assignee', label: 'Assignee', type: 'user' },
        {
          schemeId: id.scheme,
          key: 'priority',
          label: 'Priority',
          type: 'option',
          optionSetId: id.prioritySet!,
        },
        {
          schemeId: id.scheme,
          key: 'unused',
          label: 'Unused',
          type: 'option',
          optionSetId: id.unusedSet!,
        },
      ])
      .returning();
    name(['title', 'status', 'assignee', 'priority', 'unusedField'], fieldRows);
    created.fields.push(...fieldRows.map((f) => f.id));

    const typeRows = await db
      .insert(itemTypes)
      .values([
        { schemeId: id.scheme, key: 'task', label: 'Task', position: 0 },
        { schemeId: id.scheme, key: 'epic', label: 'Epic', position: 1 },
        { schemeId: id.scheme, key: 'unused', label: 'Unused', position: 2 },
      ])
      .returning();
    name(['task', 'epic', 'unusedType'], typeRows);
    created.types.push(...typeRows.map((t) => t.id));
    await db.insert(itemTypeFields).values([
      { itemTypeId: id.task!, fieldId: id.title!, position: 0 },
      { itemTypeId: id.task!, fieldId: id.status!, position: 1 },
      { itemTypeId: id.task!, fieldId: id.assignee!, position: 2 },
      { itemTypeId: id.epic!, fieldId: id.title!, position: 0 },
      { itemTypeId: id.epic!, fieldId: id.status!, position: 1 },
      { itemTypeId: id.epic!, fieldId: id.priority!, position: 2 },
      { itemTypeId: id.unusedType!, fieldId: id.unusedField!, position: 0 },
    ]);
    await db.insert(itemTypeChildTypes).values({ parentTypeId: id.epic!, childTypeId: id.task! });
    const [blocks] = await db
      .insert(linkTypes)
      .values({
        itemTypeId: id.task!,
        key: 'blocks',
        label: 'Blocks',
        inverseLabel: 'Blocked by',
        directional: true,
        position: 0,
      })
      .returning();
    id.blocks = blocks!.id;
    created.linkTypes.push(id.blocks);

    const projectRows = await db
      .insert(projects)
      .values([
        { key: keyA, name: 'Export A', itemPrefix: prefixA, schemeId: id.scheme },
        {
          key: keyB,
          name: 'Export B',
          itemPrefix: `EXB${suffix.toUpperCase()}`,
          schemeId: id.scheme,
        },
      ])
      .returning();
    name(['A', 'B'], projectRows);
    created.projects.push(...projectRows.map((p) => p.id));
    const viewRows = await db
      .insert(views)
      .values([
        { projectId: id.A!, name: 'A board', position: 0 },
        { projectId: id.B!, name: 'B board', position: 0 },
      ])
      .returning();
    name(['viewA', 'viewB'], viewRows);
    created.views.push(...viewRows.map((v) => v.id));

    const item = (
      projectId: number,
      typeId: number,
      number: number,
      extra: Partial<typeof items.$inferInsert> = {},
    ) => ({
      projectId,
      typeId,
      number,
      createdBy: id.alice!,
      createdAt: OLD,
      updatedAt: OLD,
      ...extra,
    });
    const itemRows = await db
      .insert(items)
      .values([
        item(id.B!, id.task!, 1), // b1
        item(id.B!, id.task!, 2), // b2
      ])
      .returning();
    name(['b1', 'b2'], itemRows);
    const aRows = await db
      .insert(items)
      .values([
        item(id.A!, id.epic!, 1), // a1: active
        item(id.A!, id.task!, 2), // a2: done, a1's child
        item(id.A!, id.task!, 3, { archivedAt: RECENT }), // a3: archived lately
        item(id.A!, id.task!, 4), // a4: todo, changed lately by a version-1 event
        item(id.A!, id.task!, 5), // a5: no status; its parent is in B
        item(id.A!, id.task!, 6), // a6: blocked; only legacy (v0) and item.imported events lately
      ])
      .returning();
    name(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], aRows);
    created.items.push(...itemRows.map((i) => i.id), ...aRows.map((i) => i.id));
    await db
      .update(items)
      .set({ parentId: id.a1! })
      .where(inArray(items.id, [id.a2!]));
    await db
      .update(items)
      .set({ parentId: id.b1! })
      .where(inArray(items.id, [id.a5!]));

    const valueRows = await db
      .insert(itemValues)
      .values([
        ...(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2'] as const).map((k) => ({
          itemId: id[k]!,
          fieldId: id.title!,
          valueText: `${k} title`,
        })),
        { itemId: id.a1!, fieldId: id.status!, optionId: id.doing! },
        { itemId: id.a2!, fieldId: id.status!, optionId: id.done! },
        { itemId: id.a3!, fieldId: id.status!, optionId: id.backlog! },
        { itemId: id.a4!, fieldId: id.status!, optionId: id.backlog! },
        { itemId: id.a6!, fieldId: id.status!, optionId: id.blocked! },
        { itemId: id.a1!, fieldId: id.priority!, optionId: id.high! },
        { itemId: id.a1!, fieldId: id.assignee!, valueUserId: id.alice! },
        { itemId: id.b1!, fieldId: id.status!, optionId: id.cancelled! },
      ])
      .returning();
    created.values.push(...valueRows.map((v) => v.id));

    const commentRows = await db
      .insert(comments)
      .values([
        { itemId: id.a2!, authorId: id.alice!, body: 'on a2', createdAt: OLD },
        { itemId: id.b1!, authorId: id.alice!, body: 'on b1', createdAt: RECENT },
      ])
      .returning();
    name(['commentA', 'commentB'], commentRows);
    created.comments.push(...commentRows.map((c) => c.id));
    await db
      .insert(commentReactions)
      .values({ commentId: id.commentA!, userId: id.bot!, emoji: '+1', createdAt: OLD });

    const linkRows = await db
      .insert(itemLinks)
      .values([
        { linkTypeId: id.blocks!, sourceItemId: id.a1!, targetItemId: id.a4!, createdAt: OLD }, // inside A
        { linkTypeId: id.blocks!, sourceItemId: id.a4!, targetItemId: id.b2!, createdAt: OLD }, // A -> B
        { linkTypeId: id.blocks!, sourceItemId: id.b1!, targetItemId: id.b2!, createdAt: RECENT }, // inside B
      ])
      .returning();
    name(['linkAA', 'linkAB', 'linkBB'], linkRows);
    created.links.push(...linkRows.map((l) => l.id));

    const event = (
      aggregateType: string,
      aggregateId: number,
      seq: number,
      kind: string,
      version: number,
      at: string,
      projectId: number | null,
      payload = {},
    ) => {
      const correlationId = randomUUID();
      return {
        aggregateType,
        aggregateId,
        seq,
        kind,
        version,
        at,
        projectId,
        payload,
        actorId: id.bot!,
        commandId: correlationId,
        correlationId,
      };
    };
    const eventRows = await db
      .insert(events)
      .values([
        event('item', id.a6!, 1, 'item.created', 0, RECENT, id.A!, { title: 'a6' }),
        event('item', id.a6!, 2, 'item.imported', 1, RECENT, id.A!, { values: [] }),
        event('item', id.a4!, 1, 'item.field_changed', 1, RECENT, id.A!, {
          fieldKey: 'assignee',
          from: null,
          to: id.carol!,
        }),
        event('project', id.A!, 1, 'project.updated', 1, OLD, null, {
          changes: { name: 'Export A' },
        }),
        event('item', id.b1!, 1, 'item.field_changed', 1, RECENT, id.B!, {
          fieldKey: 'title',
          from: 'x',
          to: 'b1 title',
        }),
      ])
      .returning();
    name(['evA6v0', 'evA6imported', 'evA4', 'evProjectA', 'evB1'], eventRows);
    created.events.push(...eventRows.map((e) => e.id));

    await db.insert(itemActivity).values({
      itemId: id.a4!,
      eventId: id.evA4!,
      projectId: id.A!,
      kind: 'item.field_changed',
      actorId: id.bot!,
      at: RECENT,
      correlationId: eventRows[2]!.correlationId,
      summary: { fieldKey: 'assignee' },
    });
    const commandId = eventRows[2]!.commandId;
    created.commands.push(commandId);
    await db
      .insert(commands)
      .values({
        id: commandId,
        aggregateType: 'item',
        aggregateId: id.a4!,
        actorId: id.bot!,
        at: RECENT,
      });
    await db.insert(outbox).values({ eventId: id.evA4! });

    [exp] = (await exportProjects(reader, [prefixA.toLowerCase()])) as [ProjectExport];
  }, 60_000);

  afterAll(async () => {
    // children before parents; parent_id first, since a2/a5 point at a1/b1
    if (db) {
      await db.delete(outbox).where(inArray(outbox.eventId, created.events));
      await db.delete(itemActivity).where(inArray(itemActivity.eventId, created.events));
      if (created.commands.length)
        await db.delete(commands).where(inArray(commands.id, created.commands));
      if (created.events.length) await db.delete(events).where(inArray(events.id, created.events));
      if (created.comments.length)
        await db
          .delete(commentReactions)
          .where(inArray(commentReactions.commentId, created.comments));
      if (created.comments.length)
        await db.delete(comments).where(inArray(comments.id, created.comments));
      if (created.links.length)
        await db.delete(itemLinks).where(inArray(itemLinks.id, created.links));
      if (created.values.length)
        await db.delete(itemValues).where(inArray(itemValues.id, created.values));
      if (created.items.length) {
        await db.update(items).set({ parentId: null }).where(inArray(items.id, created.items));
        await db.delete(items).where(inArray(items.id, created.items));
      }
      if (created.views.length) await db.delete(views).where(inArray(views.id, created.views));
      if (created.projects.length)
        await db.delete(projects).where(inArray(projects.id, created.projects));
      if (created.linkTypes.length)
        await db.delete(linkTypes).where(inArray(linkTypes.id, created.linkTypes));
      if (created.types.length) {
        await db
          .delete(itemTypeChildTypes)
          .where(inArray(itemTypeChildTypes.parentTypeId, created.types));
        await db.delete(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, created.types));
        await db.delete(itemTypes).where(inArray(itemTypes.id, created.types));
      }
      if (created.fields.length) await db.delete(fields).where(inArray(fields.id, created.fields));
      if (created.options.length)
        await db.delete(options).where(inArray(options.id, created.options));
      if (created.sets.length)
        await db.delete(optionSets).where(inArray(optionSets.id, created.sets));
      if (id.scheme) await db.delete(schemes).where(raw`${schemes.id} = ${id.scheme}`);
      if (created.users.length) await db.delete(users).where(inArray(users.id, created.users));
    }
    await reader?.end();
    await writer?.end();
  });

  const idsOf = (rows: Record<string, unknown>[], column = 'id') =>
    rows.map((r) => r[column]).sort((a, b) => Number(a) - Number(b));

  it('finds a project by its item prefix in any case, and names it', () => {
    expect(exp.project).toEqual({ id: id.A, key: keyA, name: 'Export A', itemPrefix: prefixA });
    expect(exp.format).toBe('tickets.project-export');
    expect(exp.database).toBe('tickets_test');
  });

  it("exports exactly the project's own rows", () => {
    expect(idsOf(exp.rows['core.projects'])).toEqual([id.A]);
    expect(idsOf(exp.rows['structure.views'])).toEqual([id.viewA]);
    expect(idsOf(exp.rows['records.items'])).toEqual([id.a1, id.a2, id.a3, id.a4, id.a5, id.a6]);
    const ownItems = new Set(idsOf(exp.rows['records.items']));
    expect(exp.rows['records.item_values']).toHaveLength(6 + 5 + 2);
    expect(exp.rows['records.item_values'].every((v) => ownItems.has(v.item_id))).toBe(true);
    expect(idsOf(exp.rows['records.comments'])).toEqual([id.commentA]);
    expect(exp.rows['records.comment_reactions']).toHaveLength(1);
    // the link from A into B is A's too; the one inside B is not
    expect(idsOf(exp.rows['records.item_links'])).toEqual([id.linkAA, id.linkAB]);
    expect(idsOf(exp.rows['history.events'])).toEqual([
      id.evA6v0,
      id.evA6imported,
      id.evA4,
      id.evProjectA,
    ]);
    expect(idsOf(exp.rows['history.item_activity'], 'event_id')).toEqual([id.evA4]);
    expect(idsOf(exp.rows['history.commands'], 'aggregate_id')).toEqual([id.a4]);
    expect(idsOf(exp.rows['history.outbox'], 'event_id')).toEqual([id.evA4]);
  });

  it('counts every table it exports', () => {
    for (const t of PROJECT_TABLES) expect(exp.counts[t]).toBe(exp.rows[t].length);
  });

  it('copies the shared structure the rows point at, and only that', () => {
    const keys = (rows: Record<string, unknown>[]) => rows.map((r) => r.key).sort();
    expect(idsOf(exp.referenced['structure.schemes'])).toEqual([id.scheme]);
    expect(keys(exp.referenced['structure.item_types'])).toEqual(['epic', 'task']);
    expect(keys(exp.referenced['structure.fields'])).toEqual([
      'assignee',
      'priority',
      'status',
      'title',
    ]);
    expect(keys(exp.referenced['structure.option_sets'])).toEqual(['priority', 'status']);
    expect(
      exp.referenced['structure.options']
        .map((o) => o.kind)
        .filter(Boolean)
        .sort(),
    ).toEqual(['active', 'blocked', 'done', 'dropped', 'todo']);
    expect(exp.referenced['structure.item_type_fields']).toHaveLength(6);
    expect(exp.referenced['structure.item_type_child_types']).toEqual([
      { parent_type_id: id.epic, child_type_id: id.task },
    ]);
    expect(keys(exp.referenced['structure.link_types'])).toEqual(['blocks']);
    // alice and bot from the rows, carol from the field_changed payload; dave from nothing
    expect(idsOf(exp.referenced['core.users'])).toEqual([id.alice, id.bot, id.carol]);
  });

  it('names the items of other projects that links and parents point at', () => {
    expect(exp.outsideItems.map((i) => [i.id, i.project_key, i.number, i.title])).toEqual([
      [id.b1, keyB, 1, 'b1 title'],
      [id.b2, keyB, 2, 'b2 title'],
    ]);
  });

  it("keeps the database's own values: microsecond timestamps as text, ids as numbers", () => {
    const a3 = exp.rows['records.items'].find((i) => i.id === id.a3)!;
    expect(a3.archived_at).toMatch(/\.654321\+00$/);
    expect(exp.rows['history.events'].every((e) => typeof e.id === 'number')).toBe(true);
    expect(JSON.parse(JSON.stringify(exp))).toEqual(exp);
  });

  it('accepts a project key too, and exports a project named twice once', async () => {
    const both = await exportProjects(reader, [keyA, prefixA, keyB.toUpperCase()]);
    expect(both.map((e) => e.project.id)).toEqual([id.A, id.B]);
    expect(both[0]!.exportedAt).toBe(both[1]!.exportedAt); // one snapshot
  });

  it('refuses a project that does not exist', async () => {
    await expect(exportProjects(reader, ['NO-SUCH-PROJECT'])).rejects.toBeInstanceOf(
      UnknownProjectError,
    );
  });

  it('cannot write: the session and the snapshot are both read-only', async () => {
    await expect(
      reader`INSERT INTO core.users (name, kind) VALUES (${`never-${suffix}`}, 'human')`,
    ).rejects.toThrow(/read-only transaction/);
    await expect(
      readOnlySnapshot(reader, (tx) => tx`DELETE FROM core.users WHERE id = ${id.dave!}`),
    ).rejects.toThrow(/read-only transaction/);
    const [still] = await writer`SELECT count(*)::int AS n FROM core.users WHERE id = ${id.dave!}`;
    expect(still!.n).toBe(1);
  });

  it('counts what is open and what changed lately, from the export alone', () => {
    expect(summarizeExport(exp, { now: NOW, days: 90 })).toEqual({
      project: prefixA,
      items: 6,
      archived: 1, // a3
      open: 4, // a1 active, a4 todo, a5 no status, a6 blocked
      closed: 1, // a2 done
      noStatus: 1,
      byKind: { todo: 1, active: 1, blocked: 1, done: 1, dropped: 0 },
      changedSince: '2026-07-15T00:00:00.000Z',
      // a3 (archived lately) and a4 (a version-1 field change); not a6, whose
      // recent events are a legacy v0 copy and the import's baseline
      changedRecently: 2,
      openChangedRecently: 1,
      lastChange: '2026-09-30T12:00:00.654Z',
    });
  });

  it('parses the timestamps postgres renders', () => {
    expect(parsePgTimestamp('2026-07-04 20:22:42.524214+00')).toBe(
      Date.parse('2026-07-04T20:22:42.524Z'),
    );
    expect(parsePgTimestamp('2026-07-04 20:22:42+05:30')).toBe(Date.parse('2026-07-04T14:52:42Z'));
    expect(() => parsePgTimestamp('yesterday')).toThrow();
  });
});
