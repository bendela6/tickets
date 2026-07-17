import { expect, it } from 'vitest';
import { allAutomations, automationsFor, defineAutomation } from './registry';

it('registers and looks up automations by event kind', () => {
  const rule = defineAutomation({
    id: 'test-registry-rule',
    on: ['item.field_changed', 'item.created'],
    when: async () => true,
    run: async () => {},
  });
  expect(automationsFor('item.created')).toContain(rule);
  expect(automationsFor('item.field_changed')).toContain(rule);
  expect(automationsFor('comment.added')).not.toContain(rule);
  expect(allAutomations()).toContain(rule);
});

it('rejects a duplicate automation id', () => {
  defineAutomation({ id: 'dup-rule', on: ['x'], when: async () => true, run: async () => {} });
  expect(() => defineAutomation({ id: 'dup-rule', on: ['y'], when: async () => true, run: async () => {} }))
    .toThrow(/already registered/);
});
