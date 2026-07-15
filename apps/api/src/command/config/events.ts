import * as v from 'valibot';
import { defineEvent } from '../../event/registry';

const cfg = (kind: string, aggregateType: string, payload: v.GenericSchema) =>
  defineEvent({ kind, aggregateType, version: 1, payload });

export const fieldCreated = cfg('field.created', 'field',
  v.object({ schemeId: v.number(), key: v.string(), label: v.string(), type: v.string() }));
export const fieldPlaced = cfg('field.placed', 'field',
  v.object({ itemTypeId: v.number(), position: v.number(), required: v.boolean() }));
export const fieldUpdated = cfg('field.updated', 'field',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const optionCreated = cfg('option.created', 'option',
  v.object({ optionSetId: v.number(), value: v.string(), label: v.string(), kind: v.nullable(v.string()) }));
export const optionUpdated = cfg('option.updated', 'option',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const transitionCreated = cfg('transition.created', 'transition',
  v.object({ fieldId: v.number(), fromOptionId: v.nullable(v.number()), toOptionId: v.number(), itemTypeId: v.nullable(v.number()) }));
export const transitionDeleted = cfg('transition.deleted', 'transition', v.object({}));
export const linkTypeCreated = cfg('link_type.created', 'link_type',
  v.object({ itemTypeId: v.number(), key: v.string(), label: v.string() }));
export const schemeForked = cfg('scheme.forked', 'scheme',
  v.object({ sourceSchemeId: v.number(), key: v.string(), name: v.string() }));
export const projectCreated = cfg('project.created', 'project',
  v.object({ key: v.string(), name: v.string(), itemPrefix: v.string(), schemeId: v.number() }));
export const userCreated = cfg('user.created', 'user',
  v.object({ name: v.string(), kind: v.string() }));
export const viewCreated = cfg('view.created', 'view',
  v.object({ projectId: v.number(), name: v.string() }));
export const viewUpdated = cfg('view.updated', 'view',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
