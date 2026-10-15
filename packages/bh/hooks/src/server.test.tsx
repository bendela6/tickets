// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  useAction,
  useDebouncedCallback,
  useDebouncedValue,
  useDisclosure,
  useDrag,
  useElementSize,
  useHotkeys,
  useIsClipped,
  useMediaQuery,
  useNow,
  usePersistedState,
  useResizeHandle,
  useScrollSpy,
} from './index';

// A static build renders each page where there is no window, document or
// element. Every hook renders there, touching none of them, and gives its
// server value; each new hook adds itself here, in the order of the index.
function EveryHook() {
  const save = useAction(() => Promise.resolve('saved'));
  const { isPending } = useDebouncedCallback(() => undefined, { delay: 300 });
  const query = useDebouncedValue('shoes', { delay: 300 });
  const { isOpen } = useDisclosure();
  const { isDragging } = useDrag();
  const { width: measured, ref } = useElementSize<HTMLParagraphElement>();
  useHotkeys({ keys: { 'mod+k': () => undefined } });
  const clipped = useIsClipped('packages/web/hooks/src/index.ts');
  const narrow = useMediaQuery('(max-width: 767px)');
  const now = useNow();
  const [width] = usePersistedState({ key: 'test:width', defaultValue: 240 });
  const height = useResizeHandle({ orientation: 'horizontal' });
  const { activeId } = useScrollSpy(['sowing', 'watering']);
  return (
    <p ref={ref}>
      {[
        save.isPending,
        save.error,
        save.result,
        isPending,
        query,
        isOpen,
        isDragging,
        measured,
        clipped.isClipped,
        narrow,
        now > 0,
        width,
        height.value,
        activeId,
      ]
        .map(String)
        .join(' ')}
    </p>
  );
}

describe('every hook, on a server', () => {
  it('renders with no DOM, and gives its server value', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(renderToString(<EveryHook />)).toBe(
      '<p>false undefined undefined false shoes false false undefined false false true 240 undefined sowing</p>',
    );
  });
});
