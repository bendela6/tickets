import {
  BARE_REACH, DEFAULT_DOC, type Element, type ElementType, type IconDoc, type Ink,
  type MotionConfig, type Variant,
} from './doc';

export interface StudioState {
  doc: IconDoc;
}

export const INITIAL_STATE: StudioState = { doc: structuredClone(DEFAULT_DOC) };

/** A new element of each type, placed so it is visible the moment it is added. */
function blankElement(type: ElementType, id: string): Element {
  switch (type) {
    case 'stick':
      return { id, type, ink: 'top', spin: true, angle: 0, reach: BARE_REACH, weight: 6 };
    case 'ring':
      return { id, type, ink: 'top', radius: 15, weight: 3 };
    case 'dot':
      return { id, type, ink: 'top', at: [24, 24], radius: 4 };
  }
}

/** Ids must stay unique: React keys and per-element controls hang off them. */
function freshId(doc: IconDoc, type: ElementType): string {
  const taken = new Set(doc.elements.map((e) => e.id));
  for (let n = 1; ; n++) {
    const id = `${type}-${n}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * A patch for one element, restricted to the fields its own type actually has
 * (`angle`/`reach` for a stick, `radius` for a ring or dot, and so on).
 *
 * Plain `Partial<Omit<Element, 'id' | 'type'>>` does not do this: `Omit` and
 * `Partial` only distribute over a union when they're driven by a bare type
 * parameter in a conditional type, and neither is written that way. Applied
 * directly to the `Element` union, `keyof Element` collapses to the fields
 * every branch shares — `ink` and `spin` — silently dropping `angle`,
 * `reach`, `weight`, `radius` and `at` from the patch type entirely. `T`
 * below is a bare parameter, so this version distributes correctly.
 */
type ElementPatch<T extends Element = Element> = T extends unknown
  ? Partial<Omit<T, 'id' | 'type'>>
  : never;

export type StudioAction =
  | { type: 'addElement'; elementType: ElementType }
  | { type: 'removeElement'; id: string }
  | { type: 'moveElement'; id: string; to: number }
  | { type: 'updateElement'; id: string; patch: ElementPatch }
  | { type: 'setInk'; name: string; patch: Partial<Ink> }
  | { type: 'setVariant'; name: string; patch: Partial<Variant> }
  | { type: 'setMotion'; patch: Partial<MotionConfig> }
  | { type: 'resetMotion' }
  | { type: 'loadDoc'; doc: IconDoc };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  const { doc } = state;
  switch (action.type) {
    case 'addElement': {
      const element = blankElement(action.elementType, freshId(doc, action.elementType));
      return { doc: { ...doc, elements: [...doc.elements, element] } };
    }
    case 'removeElement':
      return { doc: { ...doc, elements: doc.elements.filter((e) => e.id !== action.id) } };
    case 'moveElement': {
      const from = doc.elements.findIndex((e) => e.id === action.id);
      if (from === -1) return state;
      const elements = [...doc.elements];
      const [moved] = elements.splice(from, 1);
      if (!moved) return state;
      const to = Math.max(0, Math.min(action.to, elements.length));
      elements.splice(to, 0, moved);
      return { doc: { ...doc, elements } };
    }
    case 'updateElement':
      return {
        doc: {
          ...doc,
          elements: doc.elements.map((e) =>
            e.id === action.id ? ({ ...e, ...action.patch } as Element) : e,
          ),
        },
      };
    case 'setInk': {
      const existing = doc.inks[action.name];
      if (!existing) return state;
      return { doc: { ...doc, inks: { ...doc.inks, [action.name]: { ...existing, ...action.patch } } } };
    }
    case 'setVariant': {
      const existing = doc.variants[action.name];
      if (!existing) return state;
      return {
        doc: { ...doc, variants: { ...doc.variants, [action.name]: { ...existing, ...action.patch } } },
      };
    }
    case 'setMotion':
      return { doc: { ...doc, motion: { ...doc.motion, ...action.patch } } };
    case 'resetMotion':
      return { doc: { ...doc, motion: { ...DEFAULT_DOC.motion } } };
    case 'loadDoc':
      return { doc: action.doc };
  }
}
