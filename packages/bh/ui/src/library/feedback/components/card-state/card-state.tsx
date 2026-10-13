import type { ReactNode } from 'react';
import { Stack, type Gap } from '../../../layout/components/stack';
import { ScreenState } from '../screen-state';
import { Spinner } from '../spinner';

// The states of a card that loads, in one place so they cannot drift apart
// between cards: waiting for the first answer, no answer at all, an answer
// with nothing in it, and the answer. Two apps kept a copy each (a gateway's
// overview cards, a media dashboard's); this is the two merged.
//
// The error wins over loading, as both copies had it: a query that failed and
// is retrying is still a failure to show, not a spinner to wait on.

/** What an error says: its own message, or a sentence for whatever else was thrown. */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'The request failed.';
}

/**
 * A loading card's states: a spinner before the first answer, an error when
 * there is none, a line when it holds nothing, and its content.
 */
export function CardState({
  isLoading = false,
  error,
  isEmpty = false,
  emptyText = 'Nothing here.',
  gap = 4,
  children,
}: {
  /** No answer yet: shows a spinner in place of the content. */
  isLoading?: boolean;
  /**
   * The request failed: shows its message in place of the content. Anything
   * thrown is taken, as a query library hands it over; `null` and `undefined`
   * are no error.
   */
  error?: unknown;
  /** The answer came and holds nothing to show: `emptyText` stands in for the content. */
  isEmpty?: boolean;
  /** What an empty answer says. */
  emptyText?: string;
  /** Space between the content's parts, in steps of 4 pixels. */
  gap?: Gap;
  /**
   * The content, in a column. A note on a partial answer (a source that did
   * not reply) goes last, so it shows with the numbers that did come.
   */
  children: ReactNode;
}) {
  if (error != null) {
    return (
      <ScreenState
        tone="danger"
        icon="triangle-alert"
        title="Could not load"
        body={messageOf(error)}
      />
    );
  }
  if (isLoading) {
    return (
      <div role="status" className="text-gray-10 flex items-center justify-center py-32">
        <Spinner size="md" />
      </div>
    );
  }
  if (isEmpty) {
    return <ScreenState icon="search" title={emptyText} />;
  }
  return (
    <Stack gap={gap} className="min-w-0">
      {children}
    </Stack>
  );
}
