import type { Board, Field, Item, ItemType, ItemTypeField, Option, User } from '../api/types';

export function indexBoard(board: Board) {
  const typeById = new Map<number, ItemType>(board.types.map((t) => [t.id, t]));
  const fieldById = new Map<number, Field>(board.fields.map((f) => [f.id, f]));
  const fieldByKey = new Map<string, Field>(board.fields.map((f) => [f.key, f]));
  const userById = new Map<number, User>(board.users.map((u) => [u.id, u]));
  const itemById = new Map<number, Item>(board.items.map((i) => [i.id, i]));
  const itemByNumber = new Map<number, Item>(board.items.map((i) => [i.number, i]));
  const optionById = new Map<number, Option>(board.options.map((o) => [o.id, o]));

  const optionsBySetId = new Map<number, Option[]>();
  for (const o of board.options) {
    if (o.archivedAt) continue;
    const bucket = optionsBySetId.get(o.optionSetId) ?? [];
    bucket.push(o);
    optionsBySetId.set(o.optionSetId, bucket);
  }
  for (const bucket of optionsBySetId.values()) bucket.sort((a, b) => a.position - b.position);

  const placementsByType = new Map<number, ItemTypeField[]>();
  for (const p of board.placements) {
    const bucket = placementsByType.get(p.itemTypeId) ?? [];
    bucket.push(p);
    placementsByType.set(p.itemTypeId, bucket);
  }
  for (const bucket of placementsByType.values()) bucket.sort((a, b) => a.position - b.position);

  const childrenByParent = new Map<number, Item[]>();
  for (const item of board.items) {
    if (item.parentId !== null && !item.archivedAt) {
      const bucket = childrenByParent.get(item.parentId) ?? [];
      bucket.push(item);
      childrenByParent.set(item.parentId, bucket);
    }
  }

  function placement(typeId: number, fieldId: number): ItemTypeField | undefined {
    return placementsByType.get(typeId)?.find((p) => p.fieldId === fieldId);
  }
  function workflowField(typeId: number): Field | undefined {
    for (const p of placementsByType.get(typeId) ?? []) {
      const f = fieldById.get(p.fieldId);
      if (f && (f.config as { workflow?: boolean }).workflow === true) return f;
    }
    return undefined;
  }
  function optionsForField(typeId: number, field: Field): Option[] {
    if (field.optionSetId === null) return [];
    const all = optionsBySetId.get(field.optionSetId) ?? [];
    const allow = placement(typeId, field.id)?.configOverride?.allowedOptionIds;
    return allow ? all.filter((o) => allow.includes(o.id)) : all;
  }
  function optionByValue(field: Field, value: string): Option | undefined {
    if (field.optionSetId === null) return undefined;
    return (optionsBySetId.get(field.optionSetId) ?? []).find((o) => o.value === value);
  }

  return {
    typeById, fieldById, fieldByKey, userById, itemById, itemByNumber, optionById,
    optionsBySetId, placementsByType, childrenByParent,
    placement, workflowField, optionsForField, optionByValue,
  };
}

export type BoardIndexes = ReturnType<typeof indexBoard>;
