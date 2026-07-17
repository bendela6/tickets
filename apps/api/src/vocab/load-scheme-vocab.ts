import { eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import {
  fields, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes, optionSets,
  optionTransitions, options, projects, users, views,
} from '@tickets/db';
import { HttpError } from '../errors';

export async function loadSchemeVocab(db: DbExecutor, selector: { key?: string; id?: number }) {
  const projectRows = selector.key
    ? await db.select().from(projects).where(eq(projects.key, selector.key))
    : await db.select().from(projects).where(eq(projects.id, selector.id ?? -1));
  const project = projectRows[0];
  if (!project) throw new HttpError(404, `unknown project "${selector.key ?? selector.id}"`);
  const schemeId = project.schemeId;

  const [typeRows, fieldRows, optionSetRows, viewRows, userRows] = await Promise.all([
    db.select().from(itemTypes).where(eq(itemTypes.schemeId, schemeId)),
    db.select().from(fields).where(eq(fields.schemeId, schemeId)),
    db.select().from(optionSets).where(eq(optionSets.schemeId, schemeId)),
    db.select().from(views).where(eq(views.projectId, project.id)),
    db.select().from(users),
  ]);
  const typeIds = typeRows.map((r) => r.id);
  const fieldIds = fieldRows.map((r) => r.id);
  const setIds = optionSetRows.map((r) => r.id);

  const [placementRows, optionRows, transitionRows, linkTypeRows] = await Promise.all([
    typeIds.length ? db.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [],
    setIds.length ? db.select().from(options).where(inArray(options.optionSetId, setIds)) : [],
    fieldIds.length ? db.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, fieldIds)) : [],
    typeIds.length ? db.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds)) : [],
  ]);
  const linkTypeIds = linkTypeRows.map((r) => r.id);
  const targetRows = linkTypeIds.length
    ? await db.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds))
    : [];

  const fieldById = new Map(fieldRows.map((f) => [f.id, f]));
  const optionsBySetId = new Map<number, typeof optionRows>();
  for (const o of optionRows) {
    const bucket = optionsBySetId.get(o.optionSetId) ?? [];
    bucket.push(o);
    optionsBySetId.set(o.optionSetId, bucket);
  }
  const optionsByFieldId = new Map<number, typeof optionRows>();
  for (const f of fieldRows) {
    if (f.optionSetId != null) {
      const opts = (optionsBySetId.get(f.optionSetId) ?? []).slice().sort((a, b) => a.position - b.position);
      optionsByFieldId.set(f.id, opts);
    }
  }

  const fieldsByType = new Map<number, typeof fieldRows>();
  const fieldByTypeKey = new Map<string, (typeof fieldRows)[number]>();
  const placementByTypeField = new Map<string, (typeof placementRows)[number]>();
  const placementsSorted = placementRows.slice().sort((a, b) => a.position - b.position);
  for (const p of placementsSorted) {
    const field = fieldById.get(p.fieldId);
    if (!field) continue;
    const bucket = fieldsByType.get(p.itemTypeId) ?? [];
    bucket.push(field);
    fieldsByType.set(p.itemTypeId, bucket);
    fieldByTypeKey.set(`${p.itemTypeId}:${field.key}`, field);
    placementByTypeField.set(`${p.itemTypeId}:${p.fieldId}`, p);
  }

  const linkTypeByTypeKey = new Map(linkTypeRows.map((lt) => [`${lt.itemTypeId}:${lt.key}`, lt]));
  const linkTypeTargets = new Map<number, Set<number>>();
  for (const t of targetRows) {
    const set = linkTypeTargets.get(t.linkTypeId) ?? new Set<number>();
    set.add(t.targetTypeId);
    linkTypeTargets.set(t.linkTypeId, set);
  }

  const vocab = {
    project,
    schemeId,
    views: viewRows,
    usersById: new Map(userRows.map((u) => [u.id, u])),
    types: typeRows,
    typeByKey: new Map(typeRows.map((t) => [t.key, t])),
    typeById: new Map(typeRows.map((t) => [t.id, t])),
    fieldById,
    fieldByKey: new Map(fieldRows.map((f) => [f.key, f])),
    fieldsByType,
    fieldByTypeKey,
    placementByTypeField,
    optionById: new Map(optionRows.map((o) => [o.id, o])),
    optionsByFieldId,
    transitions: transitionRows,
    linkTypeByTypeKey,
    linkTypeTargets,
    // helper: the placed workflow field for a type (config.workflow === true)
    workflowField(typeId: number) {
      return (fieldsByType.get(typeId) ?? []).find(
        (f) => (f.config as { workflow?: boolean }).workflow === true,
      );
    },
    // helper: a field's options for a type, narrowed by the per-type allowlist if present
    optionsForField(typeId: number, fieldId: number) {
      const all = optionsByFieldId.get(fieldId) ?? [];
      const allow = (placementByTypeField.get(`${typeId}:${fieldId}`)?.configOverride as
        | { allowedOptionIds?: number[] }
        | null
        | undefined)?.allowedOptionIds;
      return allow ? all.filter((o) => allow.includes(o.id)) : all;
    },
    // helper: the default workflow option — lowest-position 'todo', else lowest position
    initialOption(typeId: number) {
      const wf = this.workflowField(typeId);
      if (!wf) return undefined;
      const opts = this.optionsForField(typeId, wf.id).filter((o) => !o.archivedAt);
      return opts.find((o) => o.kind === 'todo') ?? opts[0];
    },
  };
  return vocab;
}

export type SchemeVocab = Awaited<ReturnType<typeof loadSchemeVocab>>;
