// An example: a header naming it; the result on a stage, the code, or both,
// under or beside each other; a split that drags, a bottom edge that drags the
// height, full screen, and Copy. The panel runs nothing: the app hands in the
// result it rendered, the code, and an editor if the code can be changed.

import { useRef, useState, type ReactNode, type Ref } from 'react';
import { cn, DialogContent, DialogRoot, DialogTitle } from '@bh/ui';
import type { CodeProblem } from '../problems';
import { CodePane } from './code-pane';
import { PanelBody, type SizeKey } from './panel-body';
import { Divider, PanelAction, REVEAL } from './parts';
import { ProblemsStrip } from './problems-strip';
import { EXAMPLE_STAGE_HEIGHT, type ExamplePanelLayout, type ExamplePanelMode } from './types';

/** The code's line height and its padding above and below, for the height it scrolls at. */
const LINE_HEIGHT = 20;
const CODE_PADDING = 12;

/** Props for ExamplePanel component. */
export interface ExamplePanelProps {
  /** Names the example, in its header and to a screen reader. */
  title: string;
  /** The code as it stands: what Copy copies, and what the code pane shows without `editor`. */
  code: string;
  /** The code's grammar, for a pane drawn read-only and the bar's name: TSX unless said. */
  lang?: string;
  /** What the code bar names the code by: its file. Its grammar, in capitals, without it. */
  file?: string;
  /** The code pane: the app's editor. Without it, `code` drawn read-only, its problems' lines marked. */
  editor?: ReactNode;
  /** What the code draws, as the app rendered it. */
  result: ReactNode;
  /** What is wrong with the code: listed under it, the errors under the result too while the code is hidden. */
  problems?: readonly CodeProblem[];
  /** The code differs from what the app first showed: the bar says so. */
  edited?: boolean;
  /** Given, the bar offers Reset the source, while `edited`. */
  onReset?: () => void;
  /** What the panel opens on. */
  mode?: ExamplePanelMode;
  /** How a split opens: the code under the result, or beside it where there is room. */
  layout?: ExamplePanelLayout;
  /** Lines of code shown before the code scrolls. */
  collapse?: number;
  /** The result stage's least height in pixels. */
  height?: number;
  /** In the header, before Full screen, and shown with it: controls of the app's own. */
  actions?: ReactNode;
  /** The panel's `<section>`. */
  ref?: Ref<HTMLElement>;
}

/**
 * One example: a header naming it; the result on a stage, the code, or both,
 * under or beside each other. The controls (what it shows, how a split sits,
 * full screen) show on hover. The code scrolls past `collapse` lines; a
 * split's divider and the panel's bottom edge drag to resize it, and the
 * whole panel opens full screen.
 */
export function ExamplePanel({
  title,
  code,
  lang,
  file,
  editor,
  result,
  problems = [],
  edited = false,
  onReset,
  mode: initialMode = 'view',
  layout: initialLayout = 'vertical',
  collapse = 12,
  height = EXAMPLE_STAGE_HEIGHT,
  actions,
  ref,
}: ExamplePanelProps) {
  const [mode, setMode] = useState<ExamplePanelMode>(initialMode);
  const [layout, setLayout] = useState<ExamplePanelLayout>(initialLayout);
  // Full screen has the width for the code beside the result, so it opens so.
  const [fullLayout, setFullLayout] = useState<ExamplePanelLayout>('horizontal');
  const [full, setFull] = useState(false);
  // The result's share of a split, inline and full screen.
  const [share, setShare] = useState(0.5);
  const [fullShare, setFullShare] = useState(0.6);
  const [sizes, setSizes] = useState<Partial<Record<SizeKey, number>>>({});
  // Where focus goes back to when full screen closes.
  const opener = useRef<HTMLButtonElement>(null);

  const body = (fill: boolean) => {
    return (
      <PanelBody
        title={title}
        fill={fill}
        mode={mode}
        onMode={setMode}
        layout={fill ? fullLayout : layout}
        onLayout={fill ? setFullLayout : setLayout}
        share={fill ? fullShare : share}
        onShare={fill ? setFullShare : setShare}
        sizes={sizes}
        onSize={(key, size) => setSizes((prior) => ({ ...prior, [key]: size }))}
        stageHeight={height}
        codeHeight={codeHeightOf(code, collapse)}
        code={code}
        result={result}
        errors={
          <ProblemsStrip problems={problems.filter((problem) => problem.severity === 'error')} />
        }
        codePane={(controls, filled) => {
          return (
            <CodePane
              fill={filled}
              code={code}
              lang={lang}
              file={file}
              editor={editor}
              problems={problems}
              edited={edited}
              onReset={onReset}
              controls={controls}
              reveal={!fill}
            />
          );
        }}
      />
    );
  };

  return (
    <>
      {/* As wide as the box it is in, a flex row's included: a container
          query's box has no width of its own to shrink to. */}
      <section
        ref={ref}
        aria-label={`Example: ${title}`}
        className="group/panel border-gray-6 rounded-8 bg-gray-1 @container w-full overflow-hidden border-1"
      >
        <PanelHeader
          title={title}
          full={false}
          onFull={setFull}
          fullRef={opener}
          actions={actions}
        />
        {/* One result at a time: full screen takes it, and the page keeps its place. */}
        {full ? (
          <div
            className="text-13 text-gray-10 flex items-center justify-center p-32"
            style={{ minHeight: height }}
          >
            Open full screen. Esc brings it back.
          </div>
        ) : (
          body(false)
        )}
      </section>
      <DialogRoot open={full} onOpenChange={setFull}>
        <DialogContent
          size="fullscreen"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <PanelHeader title={title} full onFull={setFull} actions={actions} />
          <div className="@container flex min-h-0 flex-1 flex-col">{body(true)}</div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

/** The code area's height before anyone drags it: `collapse` lines, or all of them if fewer. */
function codeHeightOf(code: string, collapse: number): { natural: boolean; height: number } {
  const lines = code.replace(/\n$/, '').split('\n').length;
  return { natural: lines <= collapse, height: collapse * LINE_HEIGHT + 2 * CODE_PADDING };
}

interface PanelHeaderProps {
  title: string;
  full: boolean;
  onFull: (full: boolean) => void;
  /** The full-screen button, for focus to come back to. */
  fullRef?: Ref<HTMLButtonElement>;
  actions: ReactNode;
}

/** The title, the app's own controls, and full screen. */
function PanelHeader({ title, full, onFull, fullRef, actions }: PanelHeaderProps) {
  const titleClass = 'text-13 font-500 text-gray-12 min-w-160 flex-1 truncate font-sans';
  return (
    <header className="border-gray-6 flex min-h-40 flex-wrap items-center gap-x-12 gap-y-6 border-b-1 py-4 pr-6 pl-14">
      {/* A floor, not min-w-0: with none the title shrinks to a letter beside the
          controls instead of pushing them onto a second line. */}
      {full ? (
        <DialogTitle className={titleClass}>{title}</DialogTitle>
      ) : (
        <h3 className={titleClass}>{title}</h3>
      )}
      <div className={cn('flex items-center gap-2', !full && REVEAL)}>
        {actions == null ? null : (
          <>
            {actions}
            <Divider />
          </>
        )}
        <PanelAction
          label={full ? 'Leave full screen' : 'Full screen'}
          icon={full ? 'minimize' : 'maximize'}
          buttonRef={fullRef}
          onClick={() => onFull(!full)}
        />
      </div>
    </header>
  );
}
