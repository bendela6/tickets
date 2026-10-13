import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import {
  fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes, optionSets, options,
  optionTransitions, schemes,
} from '../schema';
import { planScheme } from './plan-scheme';
import { deleteSeededScheme, seedScheme, type SeededScheme } from './seed-scheme';

describe('the plan scheme (runs against tickets_test — see test/setup-env.ts)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let seeded: SeededScheme;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));
    seeded = await seedScheme(db, planScheme);
  });
  afterAll(async () => {
    await deleteSeededScheme(db, seeded);
    await sql.end();
  });

  const typeKey = (id: number) => [...seeded.typeIdByKey].find(([, v]) => v === id)?.[0];

  async function statusValuesOf(type: string): Promise<string[]> {
    const [placement] = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.itemTypeId, seeded.typeIdByKey.get(type)!))
      .then((rows) => rows.filter((p) => p.fieldId === seeded.fieldIdByKey.get('status')));
    const ids = (placement!.configOverride as { allowedOptionIds: number[] }).allowedOptionIds;
    const rows = await db.select().from(options).where(inArray(options.id, ids));
    return rows.sort((a, b) => a.position - b.position).map((o) => o.label);
  }

  it('has the four levels, each holding the next, a subticket holding subtickets', async () => {
    const types = await db.select().from(itemTypes).where(eq(itemTypes.schemeId, seeded.schemeId));
    expect(types.sort((a, b) => a.position - b.position).map((t) => t.key))
      .toEqual(['epic', 'feature', 'ticket', 'subticket']);

    const pairs = await db
      .select()
      .from(itemTypeChildTypes)
      .where(inArray(itemTypeChildTypes.parentTypeId, types.map((t) => t.id)));
    const holds = pairs.map((p) => `${typeKey(p.parentTypeId)} > ${typeKey(p.childTypeId)}`).sort();
    expect(holds).toEqual(['epic > feature', 'feature > ticket', 'subticket > subticket', 'ticket > subticket']);
  });

  it('gives a feature the plans\' six statuses and Cancelled, a ticket To do, Done and Cancelled', async () => {
    expect(await statusValuesOf('feature'))
      .toEqual(['Not planned', 'Planning', 'Planned', 'Designed', 'In progress', 'Done', 'Cancelled']);
    expect(await statusValuesOf('ticket')).toEqual(['To do', 'Done', 'Cancelled']);
    expect(await statusValuesOf('subticket')).toEqual(['To do', 'Done', 'Cancelled']);
    expect(await statusValuesOf('epic')).toEqual(['To do', 'Done', 'Cancelled']);
  });

  it('pins each status\'s kind: Cancelled is dropped, never done', async () => {
    const [set] = await db.select().from(optionSets)
      .where(eq(optionSets.id, seeded.optionSetIdByKey.get('status')!));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(Object.fromEntries(rows.map((o) => [o.label, o.kind]))).toEqual({
      'Not planned': 'todo',
      Planning: 'todo',
      Planned: 'todo',
      Designed: 'todo',
      'To do': 'todo',
      'In progress': 'active',
      Done: 'done',
      Cancelled: 'dropped',
    });
  });

  it('makes status the workflow field, with no edges so a status moves freely', async () => {
    const [status] = await db.select().from(fields).where(eq(fields.id, seeded.fieldIdByKey.get('status')!));
    expect(status!.type).toBe('option');
    expect((status!.config as { workflow?: boolean }).workflow).toBe(true);
    const edges = await db.select().from(optionTransitions).where(eq(optionTransitions.fieldId, status!.id));
    expect(edges).toEqual([]);
  });

  it('stores the text blocks as markdown, chosenOn as a date, waitingOn and where as json', async () => {
    const rows = await db.select().from(fields).where(eq(fields.schemeId, seeded.schemeId));
    const byKey = new Map(rows.map((f) => [f.key, f]));
    for (const key of ['description', 'statusNote', 'today', 'stays', 'rule', 'chosen', 'design']) {
      expect(byKey.get(key)?.type, key).toBe('string');
      expect((byKey.get(key)?.config as { format?: string }).format, key).toBe('markdown');
    }
    expect(byKey.get('chosenOn')?.type).toBe('date');
    expect(byKey.get('waitingOn')?.type).toBe('json');
    expect(byKey.get('where')?.type).toBe('json');
    expect(byKey.get('assignee')?.type).toBe('user');
  });

  it('offers every repo the plans name as a `repos` option, several at once', async () => {
    const [repos] = await db.select().from(fields).where(eq(fields.id, seeded.fieldIdByKey.get('repos')!));
    expect(repos!.type).toBe('option');
    expect((repos!.config as { multiple?: boolean }).multiple).toBe(true);
    const rows = await db.select().from(options).where(eq(options.optionSetId, repos!.optionSetId!));
    const values = rows.map((o) => o.value);
    for (const repo of ['tickets', 'bh', 'gateway', 'live gateway', 'items-core', 'auth']) {
      expect(values).toContain(repo);
    }
    expect(rows.every((o) => o.kind === null)).toBe(true);
  });

  it('places the plans\' fields per level: a feature its blocks and where, a ticket where and an assignee', async () => {
    const placed = async (type: string) => {
      const rows = await db.select().from(itemTypeFields)
        .where(eq(itemTypeFields.itemTypeId, seeded.typeIdByKey.get(type)!));
      const keyById = new Map([...seeded.fieldIdByKey].map(([k, v]) => [v, k]));
      return rows.sort((a, b) => a.position - b.position)
        .map((p) => `${keyById.get(p.fieldId)}${p.required ? '*' : ''}`);
    };
    expect(await placed('epic')).toEqual(['title*', 'description', 'status']);
    expect(await placed('feature')).toEqual([
      'title*', 'description', 'status', 'statusNote', 'waitingOn', 'where*', 'repos',
      'today', 'stays', 'rule', 'chosen', 'chosenOn', 'design',
    ]);
    const ticketFields = ['title*', 'description', 'status', 'where', 'repos', 'assignee'];
    expect(await placed('ticket')).toEqual(ticketFields);
    expect(await placed('subticket')).toEqual(ticketFields);
  });

  it('says its projects are plan projects', async () => {
    const [row] = await db.select().from(schemes).where(eq(schemes.id, seeded.schemeId));
    expect(row!.config).toEqual({ plan: true });
  });

  it('lets every level wait on every level: each type owns a blocks link that targets them all', async () => {
    const typeIds = [...seeded.typeIdByKey.values()];
    const owned = await db.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds));
    expect(owned.map((l) => [typeKey(l.itemTypeId), l.key, l.label, l.inverseLabel, l.directional]).sort()).toEqual(
      ['epic', 'feature', 'subticket', 'ticket'].map((t) => [t, 'blocks', 'Blocks', 'Blocked by', true]),
    );
    for (const link of owned) {
      const targets = await db.select().from(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, link.id));
      expect(targets.map((t) => typeKey(t.targetTypeId)).sort()).toEqual(['epic', 'feature', 'subticket', 'ticket']);
    }
  });
});
