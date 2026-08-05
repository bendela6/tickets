import { describe, expect, it } from 'vitest';
import { baseInputs, baseLayouts } from './registry';

describe('form registry maps', () => {
  it('registers every input the package ships', () => {
    expect(Object.keys(baseInputs).sort()).toEqual(
      ['checkbox', 'date', 'json', 'multi-select', 'number', 'radio', 'select',
       'slider', 'text', 'textarea', 'toggle'],
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
    expect(baseInputs.checkbox.defaultValue).toBe(false);
    expect(baseInputs.radio.defaultValue).toBe('');
    expect(baseInputs.date.defaultValue).toBeNull();
    expect(baseInputs.slider.defaultValue).toBe(0);
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
