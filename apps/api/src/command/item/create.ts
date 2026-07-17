import * as v from 'valibot';
import { items, itemValues } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { buildValueRows } from '../../values/build-value-rows';
import { itemCreated } from './events';
import { checkParent, checkTransition, nextItemNumber } from './helpers';

export const itemCreateInput = v.object({
  projectKey: v.pipe(v.string(), v.minLength(1)),
  typeKey: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  values: v.record(v.string(), v.unknown()),
});

export const itemCreate = defineCommand({
  kind: 'item.create',
  input: itemCreateInput,
  aggregate: () => ({ type: 'item' }), // id known only after insert
  async handler(tx, input, ctx) {
    const vocab = await loadSchemeVocab(tx, { key: input.projectKey });
    const type = vocab.typeByKey.get(input.typeKey);
    if (!type || type.archivedAt) throw new HttpError(400, `unknown item type "${input.typeKey}"`);

    // required-field gate
    for (const field of vocab.fieldsByType.get(type.id) ?? []) {
      const placement = vocab.placementByTypeField.get(`${type.id}:${field.id}`);
      if (placement?.required && !field.archivedAt) {
        const val = input.values[field.key];
        if (val === undefined || val === null || val === '') {
          throw new HttpError(400, `field "${field.key}" is required for type "${type.key}"`);
        }
      }
    }

    // default the workflow field to the initial option when the caller didn't choose
    const values = { ...input.values };
    const wf = vocab.workflowField(type.id);
    if (wf && values[wf.key] === undefined) {
      const initial = vocab.initialOption(type.id);
      if (initial) values[wf.key] = initial.value;
    }

    if (input.parentId != null) {
      await checkParent(tx, vocab, { itemId: null, parentId: input.parentId, childTypeId: type.id });
    }

    const number = await nextItemNumber(tx, vocab.project.id);
    const inserted = await tx
      .insert(items)
      .values({
        projectId: vocab.project.id,
        typeId: type.id,
        parentId: input.parentId ?? null,
        number,
        createdBy: ctx.envelope.actorId,
      })
      .returning();
    const item = inserted[0];
    if (!item) throw new HttpError(500, 'item insert returned no row');

    ctx.aggregateId = item.id;
    ctx.projectId = vocab.project.id;

    for (const [fieldKey, value] of Object.entries(values)) {
      const rows = buildValueRows(vocab, type.id, fieldKey, value);
      // entry-edge check for the workflow field
      if (wf && fieldKey === wf.key && rows[0]?.optionId) {
        checkTransition(vocab, { fieldId: wf.id, typeId: type.id, fromOptionId: null, toOptionId: rows[0].optionId });
      }
      if (rows.length > 0) {
        await tx.insert(itemValues).values(rows.map((r) => ({ ...r, itemId: item.id })));
      }
    }

    await ctx.emit(itemCreated, {
      typeKey: type.key,
      number: item.number,
      parentId: item.parentId,
      values,
    });
    return { id: item.id, number: item.number, updatedAt: item.updatedAt };
  },
});
