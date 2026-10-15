// The panel's body: the stage, the code, or both, stacked or side by side; the
// controls that pick which; a split's divider; and the bottom edge that drags
// the panel's height.

import type { CSSProperties, ReactNode } from 'react';
import { useElementSize, useResizeHandle, type UseResizeHandleResult } from '@bh/hooks';
import { cn, SegmentedControl, type Option } from '@bh/ui';
import { CopyAction } from './code-pane';
import { PanelAction, REVEAL } from './parts';
import type { ExamplePanelLayout, ExamplePanelMode } from './types';

const MODE_OPTIONS: Option[] = [
  { value: 'view', label: 'View' },
  { value: 'split', label: 'Split' },
  { value: 'source', label: 'Source' },
];

/** The code bar's height. */
export const BAR_HEIGHT = 32;

/** Below this width a split is always stacked: side by side, neither half has room. */
const BESIDE_MIN = 640;

/** How far a dragged height may shrink, and how far an arrow key moves it. */
const MIN_HEIGHT = 96;
const HEIGHT_STEP = 24;
/** A split's share for the result: how far it may go each way, and an arrow key's step. */
const MIN_SHARE = 0.2;
const SHARE_STEP = 0.05;

/** Which height a drag sets: each arrangement keeps its own. */
export type SizeKey = 'view' | 'source' | 'vertical' | 'horizontal';

/** What the panel shows, and how a split sits. */
function ModeControls({
  title,
  mode,
  onMode,
  layout,
  onLayout,
}: {
  title: string;
  mode: ExamplePanelMode;
  onMode: (mode: ExamplePanelMode) => void;
  layout: ExamplePanelLayout;
  onLayout: (layout: ExamplePanelLayout) => void;
}) {
  const beside = layout === 'horizontal';
  return (
    <div className="flex items-center gap-2">
      <SegmentedControl
        size="xs"
        label={`${title}: show`}
        options={MODE_OPTIONS}
        value={mode}
        onChange={(next) => onMode(next as ExamplePanelMode)}
      />
      {mode === 'split' ? (
        <PanelAction
          label={beside ? 'Code under the result' : 'Code beside the result'}
          icon={beside ? 'rows-2' : 'columns-2'}
          onClick={() => onLayout(beside ? 'vertical' : 'horizontal')}
          small
        />
      ) : null}
    </div>
  );
}

interface PanelBodyProps {
  title: string;
  /** Full screen: the body fills the window. */
  fill: boolean;
  mode: ExamplePanelMode;
  onMode: (mode: ExamplePanelMode) => void;
  layout: ExamplePanelLayout;
  onLayout: (layout: ExamplePanelLayout) => void;
  /** The result's share of a split. */
  share: number;
  onShare: (share: number) => void;
  sizes: Partial<Record<SizeKey, number>>;
  onSize: (key: SizeKey, size: number) => void;
  stageHeight: number;
  codeHeight: { natural: boolean; height: number };
  code: string;
  result: ReactNode;
  /** The code pane, given the controls for its bar and whether it fills a height it is given. */
  codePane: (controls: ReactNode, filled: boolean) => ReactNode;
  /** The code's errors, drawn under the result while the code is hidden. */
  errors: ReactNode;
}

/**
 * The stage, the code, or both: stacked, or side by side where there is room.
 * Inline, the bottom edge drags the panel's height; a split's divider drags
 * its share.
 */
export function PanelBody({
  title,
  fill,
  mode,
  onMode,
  layout,
  onLayout,
  share,
  onShare,
  sizes,
  onSize,
  stageHeight,
  codeHeight,
  code,
  result,
  codePane,
  errors,
}: PanelBodyProps) {
  const { width = 0, ref: box } = useElementSize<HTMLDivElement>();
  const beside = mode === 'split' && layout === 'horizontal' && width >= BESIDE_MIN;
  const key: SizeKey = mode === 'split' ? (beside ? 'horizontal' : 'vertical') : mode;
  const size = fill ? undefined : sizes[key];
  // What the bottom edge resizes, which its ref goes on: the stage alone, the
  // code, or the row they share. Each arrangement keeps the height it was
  // dragged to; until it is, the height it has, measured.
  const { getSeparatorProps: getHeightProps, ref: sized } = useResizeHandle<HTMLDivElement>({
    orientation: 'horizontal',
    value: size ?? null,
    onChange: (next) => onSize(key, next),
    min: MIN_HEIGHT,
    step: HEIGHT_STEP,
  });
  const controls = (
    <ModeControls title={title} mode={mode} onMode={onMode} layout={layout} onLayout={onLayout} />
  );

  const stage = (style: CSSProperties, className?: string) => {
    return (
      <div
        className={cn(
          'bg-gray-1 text-gray-12 flex flex-wrap items-center justify-center gap-12 p-32',
          className,
        )}
        // A dotted canvas, so the result reads as a stage rather than as more page.
        style={{
          backgroundImage: 'radial-gradient(var(--color-gray-5) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          ...style,
        }}
      >
        {result}
      </div>
    );
  };

  // The code alone, or under the result: `collapse` lines tall (all of them
  // when fewer), or the height the bottom edge was dragged to.
  const codeBox = () => {
    const height = fill
      ? undefined
      : (size ?? (codeHeight.natural ? undefined : codeHeight.height + BAR_HEIGHT));
    return (
      <div
        ref={sized}
        className={cn('flex min-h-0 flex-col', fill && 'flex-1')}
        style={height === undefined ? undefined : { height, minHeight: MIN_HEIGHT }}
      >
        {codePane(controls, fill || height !== undefined)}
      </div>
    );
  };

  let content: ReactNode;
  if (mode === 'view') {
    content = (
      <>
        <div ref={sized} className={cn('relative flex flex-col', fill && 'min-h-0 flex-1')}>
          {stage(
            fill || size === undefined
              ? { minHeight: fill ? undefined : stageHeight }
              : { height: size },
            cn(fill && 'min-h-0 flex-1', (fill || size !== undefined) && 'overflow-auto'),
          )}
          {/* The way to the code: over the stage's corner, on hover. */}
          <div
            className={cn(
              'border-gray-6 bg-gray-2 rounded-8 absolute right-8 bottom-8 flex items-center gap-2 border-1 p-2 shadow-sm',
              !fill && REVEAL,
            )}
          >
            {controls}
            <CopyAction code={code} />
          </div>
        </div>
        {/* A broken example says so with its code hidden: an empty stage would not. */}
        {errors}
        {/* Drawn in Node for a built page, the code stays in its HTML for search
            engines, out of sight; the browser draws over it. */}
        {typeof document === 'undefined' ? <pre className="sr-only">{code}</pre> : null}
      </>
    );
  } else if (mode === 'source') {
    content = codeBox();
  } else if (beside) {
    // Side by side: the code fills the row's height, which the stage or the
    // code's `collapse` lines set, whichever is taller, until it is dragged.
    content = (
      <div
        ref={sized}
        className={cn('relative grid', fill && 'min-h-0 flex-1')}
        style={{
          gridTemplateColumns: `minmax(0, ${share}fr) minmax(0, ${1 - share}fr)`,
          ...(fill
            ? {}
            : size === undefined
              ? { minHeight: Math.max(stageHeight, codeHeight.height + BAR_HEIGHT) }
              : { height: size }),
        }}
      >
        {stage({}, cn('min-h-0', (fill || size !== undefined) && 'overflow-auto'))}
        <div className="border-gray-6 flex min-h-0 min-w-0 flex-col border-l-1">
          {codePane(controls, true)}
        </div>
        <Divide
          orientation="vertical"
          label={`${title}: result and code`}
          share={share}
          onShare={onShare}
        />
      </div>
    );
  } else if (fill) {
    // Full screen, stacked: the result over the code, sharing the window.
    content = (
      <div
        ref={sized}
        className="relative grid min-h-0 flex-1"
        style={{ gridTemplateRows: `minmax(0, ${share}fr) minmax(0, ${1 - share}fr)` }}
      >
        {stage({}, 'min-h-0 overflow-auto')}
        <div className="border-gray-6 flex min-h-0 min-w-0 flex-col border-t-1">
          {codePane(controls, true)}
        </div>
        <Divide
          orientation="horizontal"
          label={`${title}: result and code`}
          share={share}
          onShare={onShare}
        />
      </div>
    );
  } else {
    content = (
      <>
        {stage({ minHeight: stageHeight })}
        <div className="border-gray-6 flex flex-col border-t-1">{codeBox()}</div>
      </>
    );
  }

  return (
    <div ref={box} className={cn('flex min-w-0 flex-col', fill && 'min-h-0 flex-1')}>
      {content}
      {fill ? null : <HeightHandle label={`${title}: height`} getSeparatorProps={getHeightProps} />}
    </div>
  );
}

/** The panel's bottom edge: drag it, or use the arrow keys, to make the panel taller or shorter. */
function HeightHandle({
  label,
  getSeparatorProps,
}: {
  label: string;
  getSeparatorProps: UseResizeHandleResult<HTMLDivElement>['getSeparatorProps'];
}) {
  return (
    <div
      {...getSeparatorProps({
        'aria-label': label,
        className:
          'group/handle border-gray-6 flex h-10 shrink-0 cursor-row-resize touch-none items-center justify-center border-t-1 outline-none',
      })}
    >
      <span className="bg-gray-6 group-hover/handle:bg-gray-8 group-focus-visible/handle:bg-indigo-9 h-3 w-32 rounded-full transition-colors" />
    </div>
  );
}

/** A split's divider: drag it, or use the arrow keys, to give the result more or less of it. */
function Divide({
  orientation,
  label,
  share,
  onShare,
}: {
  orientation: 'vertical' | 'horizontal';
  label: string;
  share: number;
  onShare: (share: number) => void;
}) {
  const across = orientation === 'vertical';
  // A share of the box the divider sits in: a drag moves it by as far as the
  // pointer goes, over the box's size.
  const { getSeparatorProps } = useResizeHandle({
    orientation,
    unit: 'share',
    value: share,
    onChange: onShare,
    min: MIN_SHARE,
    max: 1 - MIN_SHARE,
    step: SHARE_STEP,
  });
  return (
    <div
      {...getSeparatorProps({
        'aria-label': label,
        className: cn(
          'group/divide absolute z-10 flex touch-none items-center justify-center outline-none',
          across
            ? 'inset-y-0 w-10 -translate-x-1/2 cursor-col-resize'
            : 'inset-x-0 h-10 -translate-y-1/2 cursor-row-resize',
        ),
        style: across ? { left: `${share * 100}%` } : { top: `${share * 100}%` },
      })}
    >
      <span
        className={cn(
          'group-hover/divide:bg-gray-8 group-focus-visible/divide:bg-indigo-9 rounded-full bg-transparent transition-colors',
          across ? 'h-32 w-3' : 'h-3 w-32',
        )}
      />
    </div>
  );
}
