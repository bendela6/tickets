import { describe, expect, it } from 'vitest';
import { InlineFieldWrapper } from './components/inline-field-wrapper';
import { FilterChanges } from './components/filter-changes';
import { FilterCount } from './components/filter-count';
import { FilterSheet } from './components/filter-sheet';
import { baseFilter, baseInputs, baseLayouts } from './registry';

describe('form registry maps', () => {
  it('registers every input the package ships', () => {
    expect([...baseInputs.names].sort()).toEqual([
      'avatars',
      'checkbox',
      'checkbox-group',
      'color',
      'date',
      'date-range',
      'duration',
      'email',
      'file',
      'icon',
      'json',
      'list',
      'multi-select',
      'number',
      'object',
      'password',
      'pin',
      'radio',
      'range',
      'rating',
      'rules',
      'search',
      'segmented',
      'select',
      'slider',
      'tabs',
      'tags',
      'text',
      'textarea',
      'time',
      'toggle',
      'toggle-chips',
      'user',
    ]);
  });

  it('registers every layout the package ships', () => {
    expect([...baseLayouts.names].sort()).toEqual([
      'actions',
      'card',
      'column',
      'group',
      'inline',
      'row',
    ]);
  });

  it('gives a filter form its count, its changes waiting and its sheet', () => {
    expect(baseFilter).toEqual({ count: FilterCount, changes: FilterChanges, sheet: FilterSheet });
  });

  it('gives the inline layout’s fields their own wrapper, and the others none', () => {
    expect(baseLayouts.get('inline').field.Component).toBe(InlineFieldWrapper);
    expect('field' in baseLayouts.get('row')).toBe(false);
  });

  // The engine seeds a field from the FieldNode's own `defaultValue`, not from
  // this registry entry — what actually keeps `undefined` values safe is the
  // uniform fallback in every adapter (`?? ''` / `?? null` / `?? []` /
  // `Boolean(...)` for the toggle). Pin these anyway; they document the
  // channel each adapter expects.
  it('seeds each input with a default matching its value channel', () => {
    expect(baseInputs.get('text').defaultValue).toBe('');
    expect(baseInputs.get('textarea').defaultValue).toBe('');
    expect(baseInputs.get('json').defaultValue).toBe('');
    expect(baseInputs.get('number').defaultValue).toBeNull();
    expect(baseInputs.get('select').defaultValue).toBeNull();
    expect(baseInputs.get('multi-select').defaultValue).toEqual([]);
    expect(baseInputs.get('toggle').defaultValue).toBe(false);
    expect(baseInputs.get('checkbox').defaultValue).toBe(false);
    expect(baseInputs.get('radio').defaultValue).toBe('');
    expect(baseInputs.get('date').defaultValue).toBeNull();
    expect(baseInputs.get('slider').defaultValue).toBe(0);
    expect(baseInputs.get('list').defaultValue).toEqual([]);
    expect(baseInputs.get('object').defaultValue).toBeNull();
  });

  // The gap this closed: DatePicker, RadioGroup, Slider and Checkbox all
  // existed as controls and answered to ControlProps, but none had a field
  // adapter — so no generated form could reach them at all, whatever the
  // stored config said. A control without a kind is a control the engine
  // cannot render.
  it('every control the package ships can be reached from a form', () => {
    for (const kind of ['date', 'radio', 'slider', 'checkbox'] as const) {
      expect(baseInputs.get(kind), kind).toBeDefined();
    }
  });

  it('gives every input a component', () => {
    for (const [key, def] of baseInputs.entries()) {
      expect(def.Component, key).toBeTypeOf('function');
    }
  });
});

describe('the Soft Fill controls a generated form can name', () => {
  // The gap this closed, for the second time: a control with no kind is a
  // control the engine cannot render, whatever a stored config says. Sixteen
  // controls shipped from the design and none of them had one.
  const NEW_KINDS = [
    'password',
    'pin',
    'segmented',
    'checkbox-group',
    'tags',
    'rating',
    'range',
    'date-range',
    'time',
    'duration',
    'color',
    'icon',
    'user',
    'file',
  ] as const;

  it('registers each of them with a component', () => {
    for (const kind of NEW_KINDS) {
      expect(baseInputs.get(kind), kind).toBeDefined();
      expect(baseInputs.get(kind).Component, kind).toBeTypeOf('function');
    }
  });

  it('seeds each with a default matching its value channel', () => {
    // A mismatch here seeds the field with a value its adapter cannot read —
    // the failure is a control that renders empty and reports nothing.
    expect(baseInputs.get('password').defaultValue).toBe('');
    expect(baseInputs.get('pin').defaultValue).toBe('');
    expect(baseInputs.get('segmented').defaultValue).toBe('');
    expect(baseInputs.get('checkbox-group').defaultValue).toEqual([]);
    expect(baseInputs.get('tags').defaultValue).toEqual([]);
    expect(baseInputs.get('rating').defaultValue).toBe(0);
    expect(baseInputs.get('range').defaultValue).toEqual([0, 100]);
    expect(baseInputs.get('date-range').defaultValue).toEqual([null, null]);
    expect(baseInputs.get('time').defaultValue).toBeNull();
    expect(baseInputs.get('duration').defaultValue).toBeNull();
    expect(baseInputs.get('color').defaultValue).toBeNull();
    expect(baseInputs.get('icon').defaultValue).toBeNull();
    expect(baseInputs.get('user').defaultValue).toEqual([]);
    expect(baseInputs.get('file').defaultValue).toEqual([]);
  });
});

describe('the kinds a filter form draws', () => {
  // SearchInput had no kind while a form had nothing to keep of a search; a
  // filter form's value keeps it, as its query's `search`.
  it.each([
    ['search', ''],
    ['toggle-chips', []],
    ['tabs', ''],
    ['avatars', []],
    ['rules', []],
  ] as const)('registers %s with a component and its empty value', (kind, empty) => {
    expect(baseInputs.get(kind).Component).toBeTypeOf('function');
    expect(baseInputs.get(kind).defaultValue).toEqual(empty);
  });
});
