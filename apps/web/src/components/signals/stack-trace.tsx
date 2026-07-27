import { useState } from 'react';
import type { SignalPayload, SignalStackFrame } from '../../api/signals/signals-api';
import { cn, Tabs } from '@tickets/ui';
import { formatClockTime } from './format';

type Tab = 'sym' | 'raw';

// Consecutive non-in-app frames collapse into one "N framework frames" row
// (docs/design/SigIssueDetail.dc.html's "6 framework frames — react-dom,
// scheduler") so a symbolicated trace reads as "your code, occasionally
// interrupted by vendor code" instead of a wall of node_modules frames.
type SymItem = { kind: 'frame'; frame: SignalStackFrame } | { kind: 'group'; frames: SignalStackFrame[] };

function groupFrames(frames: SignalStackFrame[]): SymItem[] {
  const items: SymItem[] = [];
  for (const frame of frames) {
    if (frame.inApp) {
      items.push({ kind: 'frame', frame });
      continue;
    }
    const last = items[items.length - 1];
    if (last?.kind === 'group') {
      last.frames.push(frame);
    } else {
      items.push({ kind: 'group', frames: [frame] });
    }
  }
  return items;
}

// Distinct module names for a vendor group's collapsed label, e.g.
// "react-dom, scheduler" from file paths ending in those basenames.
function vendorLabel(frames: SignalStackFrame[]): string {
  const names = frames.map((frame) => {
    const base = frame.file.split('/').pop() ?? frame.file;
    return base.replace(/\.[^./]+$/, '');
  });
  return Array.from(new Set(names)).slice(0, 2).join(', ');
}

function FrameRow({ frame, defaultExpanded }: { frame: SignalStackFrame; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasContext = (frame.contextLines?.length ?? 0) > 0;

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => hasContext && setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2.5 px-4 py-2 text-left',
          hasContext ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <span aria-hidden className="w-3.5 shrink-0 font-sans text-[11px] text-ink-3">
          {hasContext ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="font-mono text-[12.5px] font-semibold text-ink">{frame.functionName}</span>
        {frame.inApp ? (
          <span className="inline-flex h-4.25 shrink-0 items-center rounded-[4px] bg-accent-subtle px-1.5 font-mono text-[9.5px] font-medium text-accent">
            in-app
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="font-mono text-[11.5px] text-accent">
          {frame.file}:{frame.line}
        </span>
      </button>
      {expanded && hasContext ? (
        <div className="border-t border-hairline bg-app px-4 pt-2.5 pb-3">
          <div className="overflow-hidden rounded-[8px] border border-hairline bg-inset py-2 font-mono text-[11.5px] leading-[1.75]">
            {frame.contextLines!.map((contextLine) => {
              const isErrorLine = contextLine.line === frame.line;
              return (
                <div
                  key={contextLine.line}
                  className={cn('flex gap-3.5 px-3.5', isErrorLine && 'bg-danger-subtle')}
                >
                  <span
                    className={cn(
                      'w-5.5 shrink-0 text-right text-ink-3',
                      isErrorLine && 'font-semibold text-danger',
                    )}
                  >
                    {contextLine.line}
                  </span>
                  <span className={isErrorLine ? 'text-danger' : undefined}>{contextLine.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VendorGroup({ frames }: { frames: SignalStackFrame[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-left opacity-55 hover:opacity-80"
      >
        <span aria-hidden className="w-3.5 shrink-0 font-sans text-[11px] text-ink-3">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="font-mono text-[11.5px] text-ink-3">
          {frames.length} framework frames — {vendorLabel(frames)}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-hairline px-4 py-2.5 font-mono text-[11px] leading-[1.9] text-ink-2">
          {frames.map((frame, index) => (
            <div key={index}>
              {frame.functionName} <span className="text-ink-3">@</span> {frame.file}:{frame.line}:
              {frame.column}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SymFrames({ frames }: { frames: SignalStackFrame[] }) {
  const items = groupFrames(frames);
  const firstFrameIndex = items.findIndex((item) => item.kind === 'frame');
  return (
    <div>
      {items.map((item, index) =>
        item.kind === 'frame' ? (
          <FrameRow key={index} frame={item.frame} defaultExpanded={index === firstFrameIndex} />
        ) : (
          <VendorGroup key={index} frames={item.frames} />
        ),
      )}
    </div>
  );
}

// Shown ONLY for browser occurrences that weren't symbolicated — those are
// the ones where source maps were expected but missing. Node stacks (api/mcp)
// never have source maps and arrive with real paths already, so this banner is
// suppressed for them (see StackTrace's `expectedSourceMaps`). When the
// occurrence carries no release, the "for release X" clause is dropped rather
// than rendering a bare "unknown".
function NoSourceMapsBanner({ release }: { release: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-hairline bg-opt-orange-subtle px-4 py-2.5">
      <span aria-hidden className="size-2 shrink-0 rotate-45 rounded-[1px] bg-opt-orange" />
      <span className="flex-1 font-sans text-[12px] leading-normal text-opt-orange">
        No source maps uploaded
        {release ? (
          <>
            {' '}
            for release <span className="font-mono text-[11.5px] font-medium">{release}</span>
          </>
        ) : null}{' '}
        — showing raw frames without source context.
      </span>
    </div>
  );
}

function RawFrames({
  frames,
  release,
  noSourceMaps,
}: {
  frames: SignalStackFrame[];
  release: string | null | undefined;
  noSourceMaps: boolean;
}) {
  return (
    <div>
      {noSourceMaps ? <NoSourceMapsBanner release={release} /> : null}
      <div className="px-4 py-3 font-mono text-[11.5px] leading-[1.9] text-ink-2">
        {frames.length === 0 ? <div className="text-ink-3">no raw frames recorded</div> : null}
        {frames.map((frame, index) => (
          <div key={index}>
            {frame.functionName} <span className="text-ink-3">@</span> {frame.file}:{frame.line}:
            {frame.column}
          </div>
        ))}
        {noSourceMaps ? (
          <div className="mt-2.5 rounded-[8px] border border-hairline bg-inset px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
            <span className="text-ink-3">$</span> npx signals sourcemaps upload ./dist --release{' '}
            {release ?? '?'}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Stack trace card (docs/design/SigIssueDetail.dc.html, variants sym/raw):
 * frames grouped with collapsed vendor runs and an auto-expanded top in-app
 * frame showing its context lines.
 *
 * The grouped view is driven by the symbolicated frames when the collector had
 * source maps, and otherwise falls back to the RAW frames. That fallback is the
 * point: source maps are only ever uploaded for browser bundles, so every node
 * stack (api/mcp) arrives unsymbolicated even though its frames already carry
 * real paths like `apps/api/src/values/build-value-rows.ts:23`. Previously those
 * were dumped into the flat raw list, which hid the one thing you open this card
 * for — where the error happened. Context lines are still symbolication-only.
 */
export function StackTrace({
  payload,
  release,
  occurrenceTime,
}: {
  payload: SignalPayload | undefined;
  release: string | null | undefined;
  occurrenceTime: string | undefined;
}) {
  const [tab, setTab] = useState<Tab>('sym');
  const symFrames = payload?.stackSymbolicated ?? [];
  const rawFrames = payload?.stack ?? [];
  const hasSym = symFrames.length > 0;
  // The "no source maps" banner is only truthful when symbolication was
  // actually expected and failed. Three conditions:
  //   - browser: source maps only exist for browser bundles; a node stack is
  //     never symbolicated and arrives with real paths already.
  //   - !hasSym: it wasn't symbolicated.
  //   - release present: the collector only symbolicates against maps uploaded
  //     for a specific release, so a release is what it would have matched on.
  //     Production bundles always stamp one (VITE_SIGNALS_RELEASE); dev browser
  //     errors carry none AND serve real source, so they must not show a banner
  //     complaining about maps they neither have nor need. A release also means
  //     the banner can always name it, so the vaguer no-release wording is dead.
  const expectedSourceMaps =
    payload?.platform?.runtime === 'browser' && !hasSym && release != null && release !== '';
  // Frames feeding the grouped view — symbolicated when available, raw otherwise.
  const structuredFrames = hasSym ? symFrames : rawFrames;
  const hasFrames = structuredFrames.length > 0;
  // The toggle only earns its place when there's a flat raw list to fall back
  // to; with no frames at all there's nothing to switch between.
  const showToggle = hasFrames && rawFrames.length > 0;
  const activeTab: Tab = showToggle ? tab : 'sym';

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-hairline bg-raised">
      <div className="flex h-10.5 items-center gap-2.5 border-b border-hairline px-4">
        <span className="font-sans text-[13.5px] font-semibold text-ink">Stack trace</span>
        {occurrenceTime ? (
          <span className="font-mono text-[11px] text-ink-3">
            occurrence {formatClockTime(occurrenceTime)} · newest
          </span>
        ) : null}
        <span className="flex-1" />
        {showToggle ? (
          <Tabs
            variant="pill"
            items={[
              { value: 'sym', label: 'symbolicated' },
              { value: 'raw', label: 'raw' },
            ]}
            value={activeTab}
            onChange={(next) => setTab(next as Tab)}
          />
        ) : null}
      </div>

      {payload === undefined ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no occurrence data</div>
      ) : !hasFrames ? (
        <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no stack frames recorded</div>
      ) : activeTab === 'sym' ? (
        <>
          {expectedSourceMaps ? <NoSourceMapsBanner release={release} /> : null}
          <SymFrames frames={structuredFrames} />
        </>
      ) : (
        <RawFrames frames={rawFrames} release={release} noSourceMaps={expectedSourceMaps} />
      )}
    </div>
  );
}
