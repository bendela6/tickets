import { render } from '@testing-library/react';
import { DEFAULT_DOC, type IconDoc } from '../doc';
import { MotionPreview } from './motion-preview';

/**
 * Forces `useReducedMotion` true, so the component paints synchronously from
 * `statePose` instead of starting a `requestAnimationFrame` loop — the only
 * way to get a deterministic, single-render snapshot of what the SVG
 * actually contains.
 */
function stubReducedMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(stubReducedMotion);
afterEach(() => vi.unstubAllGlobals());

function docWith(elements: IconDoc['elements']): IconDoc {
  return { ...DEFAULT_DOC, elements };
}

// This preview used to draw a fixed three stick-shaped slots
// (`[null, null, null]` refs, a literal `[2, 1, 0]` paint loop, a fixed
// `BARE_REACH`) regardless of what the document actually held. The tests
// below pin the document-driven replacement against each reachable
// consequence the review called out: a phantom stick when an element is
// removed, a fourth element staying invisible, a ring drawn as a stick, and
// a fixed reach overriding an element's own.

test('draws one shape per document element, not a fixed three', () => {
  const doc = docWith([
    { id: 'a', type: 'stick', ink: 'top', spin: true, angle: 10, reach: 18, weight: 6 },
    { id: 'b', type: 'ring', ink: 'mid', spin: false, radius: 12, weight: 3 },
  ]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  const svg = container.querySelector('svg');
  expect(svg?.querySelectorAll('path, circle').length).toBe(2);
});

test('a fourth element is drawn too, not silently dropped past a fixed three-slot array', () => {
  const doc = docWith([
    { id: 'a', type: 'stick', ink: 'top', spin: false, angle: 0, reach: 18, weight: 6 },
    { id: 'b', type: 'stick', ink: 'mid', spin: false, angle: 30, reach: 18, weight: 6 },
    { id: 'c', type: 'stick', ink: 'low', spin: false, angle: 60, reach: 18, weight: 6 },
    { id: 'd', type: 'stick', ink: 'top', spin: false, angle: 90, reach: 18, weight: 6 },
  ]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  expect(container.querySelectorAll('svg path').length).toBe(4);
});

test('a stick uses its own reach and weight, not a fixed constant', () => {
  const doc = docWith([{ id: 'a', type: 'stick', ink: 'top', spin: true, angle: 0, reach: 10, weight: 4 }]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  const path = container.querySelector('svg path');
  expect(path?.getAttribute('d')).toBe('M24 14L24 34');
  expect(path?.getAttribute('stroke-width')).toBe('4');
});

test('a ring in the lead slot draws as a circle in its own colour, not a black stick', () => {
  const doc = docWith([{ id: 'r', type: 'ring', ink: 'top', spin: false, radius: 12, weight: 3 }]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  expect(container.querySelectorAll('svg path').length).toBe(0);
  const circle = container.querySelector('svg circle');
  expect(circle).not.toBeNull();
  expect(circle?.getAttribute('stroke')).toBe(DEFAULT_DOC.inks.top?.light);
});

test('paints in reverse document order, so element[0] stays frontmost', () => {
  const doc = docWith([
    { id: 'front', type: 'stick', ink: 'top', spin: false, angle: 0, reach: 18, weight: 6 },
    { id: 'back', type: 'stick', ink: 'mid', spin: false, angle: 30, reach: 18, weight: 6 },
  ]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  const paths = [...container.querySelectorAll('svg path')];
  // 'back' (elements[1]) is emitted first in the markup; 'front' (elements[0])
  // is emitted last, so it paints on top.
  expect(paths.map((p) => p.getAttribute('transform'))).toEqual([
    'rotate(30 24 24)',
    'rotate(0 24 24)',
  ]);
});

test('an empty document draws nothing rather than three phantom sticks', () => {
  const doc = docWith([]);
  const { container } = render(<MotionPreview doc={doc} state="default" />);
  expect(container.querySelectorAll('svg path, svg circle').length).toBe(0);
});
