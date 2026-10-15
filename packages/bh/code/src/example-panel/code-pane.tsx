// The example's code: a bar naming it, with the panel's controls and what acts
// on the code; the code itself, the app's editor or a read-only block, which
// scrolls in the height it is given; and its problems under it.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn, useCopy, type IconName } from '@bh/ui';
import { CodeBlock } from '../code-block';
import { problemLines, type CodeProblem } from '../problems';
import { Divider, PanelAction, REVEAL } from './parts';
import { ProblemsStrip } from './problems-strip';

interface CodePaneProps {
  /** Fills the height it is given, and scrolls inside it. */
  fill: boolean;
  code: string;
  lang: string | undefined;
  file: string | undefined;
  editor: ReactNode;
  problems: readonly CodeProblem[];
  edited: boolean;
  onReset: (() => void) | undefined;
  /** What the panel shows, for the bar. */
  controls: ReactNode;
  /** The bar's controls show on hover. */
  reveal: boolean;
}

/**
 * The code: a bar naming it, with the panel's controls and what acts on the
 * code; the code itself, which scrolls in the height it is given; and the
 * problems under it.
 */
export function CodePane({
  fill,
  code,
  lang,
  file,
  editor,
  problems,
  edited,
  onReset,
  controls,
  reveal,
}: CodePaneProps) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // The fade says there is more, so it shows only while the code overflows:
  // checked on each render (an edit) and each resize (a drag).
  const check = useRef(() => {});
  check.current = () => {
    const pane = scroller.current;
    if (pane) {
      setOverflows(pane.scrollHeight > pane.clientHeight + 2);
      setScrolledToEnd(pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2);
    }
  };
  useLayoutEffect(() => check.current());
  useLayoutEffect(() => {
    const pane = scroller.current;
    if (!pane || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => check.current());
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={cn(
        'bg-surface-inset text-gray-12 flex min-w-0 flex-col',
        fill && 'min-h-0 flex-1',
      )}
    >
      <div className="border-gray-5 flex h-32 shrink-0 items-center gap-8 border-b-1 pr-4 pl-14">
        <span className="text-11 text-gray-10 min-w-0 truncate font-mono">
          {file ?? (lang ?? 'tsx').toUpperCase()}
        </span>
        {edited ? <span className="text-11 text-orange-11 shrink-0 font-mono">edited</span> : null}
        <div className={cn('ml-auto flex items-center gap-2', reveal && REVEAL)}>
          {controls}
          <Divider />
          {onReset ? (
            <PanelAction
              label="Reset the source"
              icon="undo"
              disabled={!edited}
              onClick={onReset}
              small
            />
          ) : null}
          <CopyAction code={code} />
        </div>
      </div>
      <div className={cn('relative min-w-0', fill && 'min-h-0 flex-1')}>
        <div
          ref={scroller}
          className={cn('overflow-y-auto overscroll-y-contain', fill && 'absolute inset-0')}
          onScroll={(event) => {
            const pane = event.currentTarget;
            setScrolledToEnd(pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2);
          }}
        >
          {editor ?? (
            <CodeBlock value={code} lang={lang ?? 'tsx'} problems={problemLines(problems)} bare />
          )}
        </div>
        {/* More below: the last lines fade, until the code is scrolled to its end. */}
        {overflows && !scrolledToEnd ? (
          <div
            aria-hidden
            className="from-surface-inset pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t to-transparent"
          />
        ) : null}
      </div>
      <ProblemsStrip problems={problems} />
    </div>
  );
}

/** Copies the code as it stands, and says whether that worked. */
export function CopyAction({ code }: { code: string }) {
  const { copied, failed, copy } = useCopy();
  const glyph: IconName = copied ? 'check' : failed ? 'x' : 'copy';
  return (
    <PanelAction
      label={copied ? 'Copied' : failed ? 'Could not copy' : 'Copy the source'}
      tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
      icon={glyph}
      onClick={() => void copy(code)}
      small
    />
  );
}
