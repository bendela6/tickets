import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLegacyClient } from './legacy-client';
import { readLegacy, type Legacy } from './read-legacy';
import { mapStructure, type StructurePlan } from './map-structure';

describe('mapStructure', () => {
  let close: () => Promise<void>;
  let plan: StructurePlan;

  beforeAll(async () => {
    const { sql } = createLegacyClient();
    close = () => sql.end();
    const legacy: Legacy = await readLegacy(sql);
    plan = mapStructure(legacy);
  });
  afterAll(async () => { await close(); });

  it('collapses 46 field definitions into 15 library fields', () => {
    expect(plan.fields).toHaveLength(15);
    expect(plan.fields.map((f) => f.key).sort()).toEqual([
      'assignee', 'component', 'description', 'environment', 'estimate', 'findings',
      'kind', 'labels', 'pr', 'priority', 'severity', 'status', 'steps', 'target_date', 'title',
    ]);
  });

  it('keeps all 46 placements', () => {
    expect(plan.placements).toHaveLength(46);
  });

  it('produces 8 option sets and 114 options', () => {
    expect(plan.optionSets).toHaveLength(8);
    const total = plan.optionSets.reduce((n, s) => n + s.options.length, 0);
    expect(total).toBe(114);
  });

  it('merges 34 statuses into one 12-option status set with lifecycle kinds', () => {
    const status = plan.optionSets.find((s) => s.key === 'status')!;
    expect(status.options).toHaveLength(12);
    expect(status.options.every((o) => o.kind !== null)).toBe(true);
    expect(status.options.find((o) => o.value === 'wont-fix')!.kind).toBe('dropped');
    expect(status.options.find((o) => o.value === 'fixed')!.kind).toBe('done');
  });

  it('gives labels an empty option set rather than no option set', () => {
    const labels = plan.optionSets.find((s) => s.key === 'labels')!;
    expect(labels.options).toHaveLength(0);
    expect(plan.fields.find((f) => f.key === 'labels')!.optionSetKey).toBe('labels');
  });

  it('records each type\'s status subset as an allowlist', () => {
    const epic = plan.placements.find((p) => p.typeKey === 'epic' && p.fieldKey === 'status')!;
    expect(epic.allowedOptionValues).toEqual(
      expect.arrayContaining(['backlog', 'in-progress', 'blocked', 'done', 'cancelled']),
    );
    expect(epic.allowedOptionValues).toHaveLength(5);
    const bug = plan.placements.find((p) => p.typeKey === 'bug' && p.fieldKey === 'status')!;
    expect(bug.allowedOptionValues).toHaveLength(9);
  });

  it('upgrades assignee to a user field and names the agents to create', () => {
    const assignee = plan.fields.find((f) => f.key === 'assignee')!;
    expect(assignee.type).toBe('user');
    expect(assignee.optionSetKey).toBeNull();
    expect(plan.agentUserNames.sort()).toEqual([
      'claude-fable-5', 'claude-haiku-4-5', 'claude-opus-4-8', 'claude-sonnet-5',
    ]);
  });

  it('maps the old field types onto the new enum', () => {
    const byKey = new Map(plan.fields.map((f) => [f.key, f]));
    expect(byKey.get('title')!.type).toBe('string');
    expect(byKey.get('status')!.type).toBe('option');
    expect(byKey.get('status')!.config).toMatchObject({ multiple: false, workflow: true });
    expect(byKey.get('labels')!.type).toBe('option');
    expect(byKey.get('labels')!.config).toMatchObject({ multiple: true });
    expect(byKey.get('priority')!.config).toMatchObject({ multiple: false });
    expect(byKey.get('target_date')!.type).toBe('date');
  });

  it('maps every legacy field id to a key', () => {
    expect(plan.fieldKeyByLegacyId.size).toBe(46);
  });

  it('maps every legacy status id and option id', () => {
    expect(plan.optionKeyByLegacyStatusId.size).toBe(34);
    expect(plan.optionKeyByLegacyOptionId.size).toBeGreaterThan(0);
  });
});
