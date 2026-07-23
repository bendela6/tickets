import type { ReactNode } from 'react';

// Minimal inline SVGs standing in for the lucide glyphs RteToolbar.dc.html
// specifies (list / link-2 / quote / plus / chevron-down / chevron-right /
// info / minus / check) — the repo has no icon library, so these are
// hand-copied path data at lucide's default 24x24 viewBox, stroke
// currentColor, strokeWidth 2 unless noted. Sized via the `size` prop to
// match each call site's spec (15px toolbar glyphs, 14px/12px menu rows).

// Icons paint with `currentColor` — wrap the call site in a text-color
// utility (e.g. `text-ink-2`) rather than passing a color prop here.
type IconProps = { size?: number };

function Svg({
  size = 15,
  strokeWidth = 2,
  children,
}: IconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconList({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
      <path d="M3 6h.01" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M8 6h13" />
    </Svg>
  );
}

export function IconLink2({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </Svg>
  );
}

export function IconQuote({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </Svg>
  );
}

export function IconPlus({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  );
}

export function IconChevronDown({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconChevronRight({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function IconInfo({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconMinus({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconCheck({ size }: IconProps) {
  return (
    <Svg size={size} strokeWidth={3}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}
