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
 * A patch for one element. Each key is checked against "some element type has
 * this field", not "one consistent element type has all of these fields":
 * `{ angle: 1 }` and `{ radius: 1 }` are individually rejected for keys no
 * branch has (e.g. `{ nonsense: 1 }`), but `{ angle: 1, radius: 1 }` together
 * still typechecks, because `Omit` strips the `type` discriminant before the
 * union of allowed keys is formed, so TypeScript can no longer tell that
 * `angle` and `radius` never coexist on one element. A patch built by
 * copying fields across element types would pass here undetected —
 * `studioReducer`'s `updateElement` case is the actual guard: it drops any
 * patch key the *matched* element does not already have, so a stray field
 * can typecheck here but never attaches at runtime.
 *
 * Plain `Partial<Omit<Element, 'id' | 'type'>>` would be even weaker: `Omit`
 * and `Partial` only distribute over a union when they're driven by a bare
 * type parameter in a conditional type, and neither is written that way.
 * Applied directly to the `Element` union, `keyof Element` collapses to the
 * fields every branch shares — `ink` and `spin` — silently dropping `angle`,
 * `reach`, `weight`, `radius` and `at` from the patch type entirely. `T`
 * below is a bare parameter, so this version at least distributes per-branch
 * before the keys get merged back into one loose union.
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
          elements: doc.elements.map((e) => {
            if (e.id !== action.id) return e;
            // `ElementPatch` cannot statically stop a patch built by copying
            // fields across element types — see its comment. Guard here at
            // runtime instead: only apply a key this specific element
            // already has, so e.g. a stray `radius` patched onto a stick
            // typechecks but silently drops rather than attaching.
            const safe = Object.fromEntries(
              Object.entries(action.patch).filter(([key]) => key in e),
            );
            return { ...e, ...safe } as Element;
          }),
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
