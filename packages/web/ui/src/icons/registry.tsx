import type { ReactNode } from 'react';

type Glyph = { viewBox: string; node: ReactNode };

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;

// Rich-text toolbar glyphs are copied verbatim (path data + viewBox) from
// apps/web/src/components/rich-text/toolbar-icons.tsx, which hand-copies
// lucide icons at their native 24x24 viewBox / stroke-width 2. Round and
// square line caps/joins match the source's <Svg> wrapper.
const rt = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// prettier-ignore
export const registry = {
  // ── shapes ──
  'circle':         { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="5.5" {...s} /> },
  'circle-half':    { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 2.5a5.5 5.5 0 0 0 0 11Z" fill="currentColor" /></> },
  'circle-dot':     { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><circle cx="8" cy="8" r="2" fill="currentColor" /></> },
  'circle-dashed':  { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="5.5" {...s} strokeDasharray="3 2.4" /> },
  'circle-check':   { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="m5.4 8.2 1.8 1.8 3.4-3.8" {...s} /></> },
  'circle-x':       { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="m6 6 4 4M10 6l-4 4" {...s} /></> },
  'circle-info':    { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="6" {...s} /><path d="M8 7.5v3.5M8 5v.01" {...s} /></> },
  'diamond':        { viewBox: '0 0 16 16', node: <path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="currentColor" /> },
  'square':         { viewBox: '0 0 16 16', node: <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" {...s} /> },
  'dot':            { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="3.5" fill="currentColor" /> },
  'arc':            { viewBox: '0 0 16 16', node: <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" {...s} /> },
  'triangle-alert': { viewBox: '0 0 16 16', node: <><path d="M8 2.2 14.8 13.6H1.2Z" {...s} strokeLinejoin="round" /><path d="M8 7v3M8 11.6v.01" {...s} /></> },
  // ── chevrons & arrows ──
  'chevron-up':     { viewBox: '0 0 16 16', node: <path d="m4 10 4-4 4 4" {...s} /> },
  'chevron-down':   { viewBox: '0 0 16 16', node: <path d="m4 6 4 4 4-4" {...s} /> },
  'chevron-left':   { viewBox: '0 0 16 16', node: <path d="m10 4-4 4 4 4" {...s} /> },
  'chevron-right':  { viewBox: '0 0 16 16', node: <path d="m6 4 4 4-4 4" {...s} /> },
  'arrow-up':       { viewBox: '0 0 16 16', node: <path d="M8 13V3M4 7l4-4 4 4" {...s} /> },
  'arrow-down':     { viewBox: '0 0 16 16', node: <path d="M8 3v10M4 9l4 4 4-4" {...s} /> },
  'arrow-up-right': { viewBox: '0 0 16 16', node: <path d="M4.5 11.5 11.5 4.5M5.8 4.5h5.7v5.7" {...s} /> },
  // ── actions ──
  'plus':           { viewBox: '0 0 16 16', node: <path d="M8 3v10M3 8h10" {...s} /> },
  'x':              { viewBox: '0 0 16 16', node: <path d="m4 4 8 8M12 4l-8 8" {...s} /> },
  'check':          { viewBox: '0 0 16 16', node: <path d="m3 8.5 3.5 3.5L13 5" {...s} strokeWidth={1.8} /> },
  'minus':          { viewBox: '0 0 16 16', node: <path d="M3 8h10" {...s} /> },
  'search':         { viewBox: '0 0 16 16', node: <><circle cx="7" cy="7" r="4.5" {...s} /><path d="m10.5 10.5 3.5 3.5" {...s} /></> },
  'copy':           { viewBox: '0 0 16 16', node: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" {...s} /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" {...s} /></> },
  'pencil':         { viewBox: '0 0 16 16', node: <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L6 12.2 2.8 13.2l1-3.2Z" {...s} strokeLinejoin="round" /> },
  'trash':          { viewBox: '0 0 16 16', node: <path d="M3 4.5h10M6.3 4.5V3h3.4v1.5M4.5 4.5l.6 9h5.8l.6-9" {...s} /> },
  'filter':         { viewBox: '0 0 16 16', node: <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" {...s} /> },
  'refresh':        { viewBox: '0 0 16 16', node: <><path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" {...s} /><path d="M13.5 2.5v2.8h-2.8" {...s} /></> },
  'grip':           { viewBox: '0 0 16 16', node: <>{[4, 8, 12].map((y) => [6, 10].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}</> },
  'ellipsis':       { viewBox: '0 0 16 16', node: <>{[3.5, 8, 12.5].map((x) => <circle key={x} cx={x} cy="8" r="1.2" fill="currentColor" />)}</> },
  'eye':            { viewBox: '0 0 16 16', node: <><path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8Z" {...s} /><circle cx="8" cy="8" r="2" {...s} /></> },
  // ── objects ──
  'columns':        { viewBox: '0 0 16 16', node: <><rect x="1.5" y="2" width="4" height="12" rx="1" {...s} /><rect x="6.5" y="2" width="4" height="8" rx="1" {...s} /><rect x="11.5" y="2" width="4" height="10" rx="1" {...s} /></> },
  'rows':           { viewBox: '0 0 16 16', node: <path d="M1.5 4h13M1.5 8h13M1.5 12h13" {...s} /> },
  'folder':         { viewBox: '0 0 16 16', node: <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" {...s} /> },
  'file':           { viewBox: '0 0 16 16', node: <><path d="M4 2h5l3.5 3.5V14H4Z" {...s} /><path d="M9 2v3.5h3.5" {...s} /></> },
  'terminal':       { viewBox: '0 0 16 16', node: <><rect x="1.5" y="3" width="13" height="10" rx="1.5" {...s} /><path d="m4.5 6.5 2 2-2 2M9 10.5h2.5" {...s} /></> },
  'sliders':        { viewBox: '0 0 16 16', node: <><path d="M3 5h6M12 5h1M3 11h1M7 11h6" {...s} /><circle cx="10" cy="5" r="1.6" {...s} /><circle cx="5" cy="11" r="1.6" {...s} /></> },
  'calendar':       { viewBox: '0 0 16 16', node: <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" {...s} /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" {...s} /></> },
  'clock':          { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 5v3.2l2.2 1.3" {...s} /></> },
  'tag':            { viewBox: '0 0 16 16', node: <><path d="M2.5 2.5h5.2L14 8.8 8.8 14 2.5 7.7Z" {...s} strokeLinejoin="round" /><circle cx="5.3" cy="5.3" r="1" fill="currentColor" /></> },
  'user':           { viewBox: '0 0 16 16', node: <><circle cx="8" cy="5.5" r="2.5" {...s} /><path d="M3.2 13.5a4.9 4.9 0 0 1 9.6 0" {...s} /></> },
  // ── rich-text set (24x24 lucide paths, copied VERBATIM from
  //     apps/web/src/components/rich-text/toolbar-icons.tsx: IconList,
  //     IconQuote, IconLink2 — stroke-width 2, round caps/joins as authored
  //     there) ──
  'list':  { viewBox: '0 0 24 24', node: <><path d="M3 12h.01" {...rt} /><path d="M3 18h.01" {...rt} /><path d="M3 6h.01" {...rt} /><path d="M8 12h13" {...rt} /><path d="M8 18h13" {...rt} /><path d="M8 6h13" {...rt} /></> },
  'quote': { viewBox: '0 0 24 24', node: <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" {...rt} /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" {...rt} /></> },
  'link':  { viewBox: '0 0 24 24', node: <><path d="M9 17H7A5 5 0 0 1 7 7h2" {...rt} /><path d="M15 7h2a5 5 0 1 1 0 10h-2" {...rt} /><line x1="8" x2="16" y1="12" y2="12" {...rt} /></> },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof registry;
export const ICON_NAMES = Object.keys(registry) as IconName[];
