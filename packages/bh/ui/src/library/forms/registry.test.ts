import { describe, expect, it } from 'vitest';
import { InlineFieldWrapper } from './components/inline-field-wrapper';
import { FilterChanges } from './components/filter-changes';
import { FilterCount } from './components/filter-count';
import { FilterSheet } from './components/filter-sheet';
import { baseFilter, baseInputs, baseLayouts } from './registry';

describe('form registry maps', () => {
  it('registers every input the package ships', () => {
    expect(Object.keys(baseInputs).sort()).toEqual([
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
    expect(Object.keys(baseLayouts).sort()).toEqual([
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
    expect(baseLayouts.inline.field.Component).toBe(InlineFieldWrapper);
    expect('field' in baseLayouts.row).toBe(false);
  });

  // The engine seeds a field from the FieldNode's own `defaultValue`, not from
  // this registry entry — what actually keeps `undefined` values safe is the
  // uniform fallback in every adapter (`?? ''` / `?? null` / `?? []` /
  // `Boolean(...)` for the toggle). Pin these anyway; they document the
  // channel each adapter expects.
  it('seeds each input with a default matching its value channel', () => {
    expect(baseInputs.text.defaultValue).toBe('');
    expect(baseInputs.textarea.defaultValue).toBe('');
    expect(baseInputs.json.defaultValue).toBe('');
    expect(baseInputs.number.defaultValue).toBeNull();
    expect(baseInputs.select.defaultValue).toBeNull();
    expect(baseInputs['multi-select'].defaultValue).toEqual([]);
    expect(baseInputs.toggle.defaultValue).toBe(false);
    expect(baseInputs.checkbox.defaultValue).toBe(false);
    expect(baseInputs.radio.defaultValue).toBe('');
    expect(baseInputs.date.defaultValue).toBeNull();
    expect(baseInputs.slider.defaultValue).toBe(0);
    expect(baseInputs.list.defaultValue).toEqual([]);
    expect(baseInputs.object.defaultValue).toBeNull();
  });

  // The gap this closed: DatePicker, RadioGroup, Slider and Checkbox all
  // existed as controls and answered to ControlProps, but none had a field
  // adapter — so no generated form could reach them at all, whatever the
  // stored config said. A control without a kind is a control the engine
  // cannot render.
  it('every control the package ships can be reached from a form', () => {
    for (const kind of ['date', 'radio', 'slider', 'checkbox'] as const) {
      expect(baseInputs[kind], kind).toBeDefined();
    }
  });

  it('gives every input a component', () => {
    for (const [key, def] of Object.entries(baseInputs)) {
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
      expect(baseInputs[kind], kind).toBeDefined();
      expect(baseInputs[kind].Component, kind).toBeTypeOf('function');
    }
  });

  it('seeds each with a default matching its value channel', () => {
    // A mismatch here seeds the field with a value its adapter cannot read —
    // the failure is a control that renders empty and reports nothing.
    expect(baseInputs.password.defaultValue).toBe('');
    expect(baseInputs.pin.defaultValue).toBe('');
    expect(baseInputs.segmented.defaultValue).toBe('');
    expect(baseInputs['checkbox-group'].defaultValue).toEqual([]);
    expect(baseInputs.tags.defaultValue).toEqual([]);
    expect(baseInputs.rating.defaultValue).toBe(0);
    expect(baseInputs.range.defaultValue).toEqual([0, 100]);
    expect(baseInputs['date-range'].defaultValue).toEqual([null, null]);
    expect(baseInputs.time.defaultValue).toBeNull();
    expect(baseInputs.duration.defaultValue).toBeNull();
    expect(baseInputs.color.defaultValue).toBeNull();
    expect(baseInputs.icon.defaultValue).toBeNull();
    expect(baseInputs.user.defaultValue).toEqual([]);
    expect(baseInputs.file.defaultValue).toEqual([]);
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
    expect(baseInputs[kind].Component).toBeTypeOf('function');
    expect(baseInputs[kind].defaultValue).toEqual(empty);
  });
});
