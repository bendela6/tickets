import { describe, expect, it } from 'vitest';
import { baseInputs, baseLayouts } from './registry';

describe('form registry maps', () => {
  it('registers every input the package ships', () => {
    expect(Object.keys(baseInputs).sort()).toEqual(
      ['json', 'multi-select', 'number', 'select', 'text', 'textarea', 'toggle'],
    );
  });

  it('registers every layout the package ships', () => {
    expect(Object.keys(baseLayouts).sort()).toEqual(['card', 'column', 'group', 'row']);
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
  });

  it('gives every input a component', () => {
    for (const [key, def] of Object.entries(baseInputs)) {
      expect(def.Component, key).toBeTypeOf('function');
    }
  });
});
