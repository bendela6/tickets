import * as v from 'valibot';
import { defineEvent } from '../../event/registry';

export const itemCreated = defineEvent({
  kind: 'item.created', aggregateType: 'item', version: 1,
  payload: v.object({
    typeKey: v.string(),
    number: v.number(),
    parentId: v.nullable(v.number()),
    values: v.record(v.string(), v.unknown()),
  }),
});
export const itemFieldChanged = defineEvent({
  kind: 'item.field_changed', aggregateType: 'item', version: 1,
  payload: v.object({ fieldKey: v.string(), from: v.unknown(), to: v.unknown() }),
});
export const itemReparented = defineEvent({
  kind: 'item.reparented', aggregateType: 'item', version: 1,
  payload: v.object({ from: v.nullable(v.number()), to: v.nullable(v.number()) }),
});
export const itemArchived = defineEvent({
  kind: 'item.archived', aggregateType: 'item', version: 1, payload: v.object({}),
});
export const itemRestored = defineEvent({
  kind: 'item.restored', aggregateType: 'item', version: 1, payload: v.object({}),
});
export const commentAdded = defineEvent({
  kind: 'comment.added', aggregateType: 'item', version: 1,
  payload: v.object({ commentId: v.number(), body: v.string() }),
});
export const agentDispatched = defineEvent({
  kind: 'item.agent_dispatched', aggregateType: 'item', version: 1,
  payload: v.object({ sessionId: v.number(), agentId: v.number() }),
});
export const itemLinked = defineEvent({
  kind: 'item.linked', aggregateType: 'item', version: 1,
  payload: v.object({ linkTypeKey: v.string(), targetItemId: v.number() }),
});
export const itemUnlinked = defineEvent({
  kind: 'item.unlinked', aggregateType: 'item', version: 1,
  payload: v.object({ linkTypeKey: v.string(), targetItemId: v.number() }),
});
