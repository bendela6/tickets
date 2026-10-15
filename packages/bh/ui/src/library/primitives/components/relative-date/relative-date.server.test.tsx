// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RelativeDate } from './relative-date';

// A static build draws a page where there is no window and no document, and
// runs no effect: RelativeDate draws its first label there, and starts no clock.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-07-06T09:00:20Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

test('draws its first label on a server, with no timer', () => {
  expect(typeof document).toBe('undefined');
  const html = renderToString(
    <>
      <RelativeDate value="2026-07-06T08:55:00Z" smallestUnit="minute" />
      <RelativeDate value="2026-07-06T06:00:00Z" smallestUnit="minute" />
      <RelativeDate value="2026-07-03T09:00:00Z" smallestUnit="minute" />
    </>,
  );
  expect(html).toMatch(/>5 minutes ago<\/span>/);
  expect(html).toMatch(/>3 hours ago<\/span>/);
  expect(html).toMatch(/>3 days ago<\/span>/);
  expect(vi.getTimerCount()).toBe(0);
});
