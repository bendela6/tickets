import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pill } from '../../library/primitives/components/pill';
import { SectionHeader } from '../../library/layout/components/section-header';
import { NATIVE_FAMILIES } from './spec';
// colors.ts owns the theme axis for the whole Foundation group — the colour
// tokens are the only ones that vary per step. Imported, not re-exported: the
// folder barrel already surfaces it from there, and a second path to the same
// symbol makes `export *` ambiguous.
import type { Theme } from './colors';

/**
 * Follows the nearest `[data-theme]` ancestor rather than the document root,
 * so a page reads correctly inside the workbench's split-theme view as well as
 * under the plain theme toggle. Shared by every foundation page — several of
 * them (shadows above all) are only honest if they know which theme they are
 * being drawn in.
 */
export function useTheme(): [Theme, (node: HTMLElement | null) => void] {
  const [theme, setTheme] = useState<Theme>('light');
  const node = useRef<HTMLElement | null>(null);
  const read = () => {
    const host = node.current?.closest('[data-theme]');
    setTheme(host?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  };
  useEffect(() => {
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  });
  return [
    theme,
    (el) => {
      node.current = el;
    },
  ];
}

/** The page wrapper every foundation state uses, so they share one rhythm. */
export function Sheet({ children }: { children: ReactNode }) {
  const [, ref] = useTheme();
  return (
    <div ref={ref} className="flex w-full flex-col gap-12">
      {children}
    </div>
  );
}

/**
 * The shared three-column row: token name, its value, then the specimen that
 * shows what the value does. Keeping the two text columns a fixed width means
 * the specimens line up down the page and can be compared to each other, which
 * is the only reason to render a scale rather than list it.
 */
export function SpecRow({
  name,
  value,
  note,
  children,
  align = 'center',
}: {
  name: string;
  value: string;
  note?: string;
  /** Optional so a row can be a plain definition where there is nothing to draw. */
  children?: ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={`flex gap-16 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <span className="w-144 shrink-0 font-mono text-12/17 font-500 text-gray-12">{name}</span>
      <span className="flex w-128 shrink-0 flex-col font-mono text-12/17 text-gray-9">
        <span>{value}</span>
        {note ? <span className="text-9/12">{note}</span> : null}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Column captions for a `SpecRow` stack. `value` is a caption because not every
 * family has a value short enough to tabulate — elevation's are three-part
 * shadow lists, so that page labels the column for what it does show.
 */
export function SpecHeader({ specimen, value = 'value' }: { specimen: string; value?: string }) {
  return (
    <div className="flex gap-16 font-mono text-9/12 uppercase tracking-widest text-gray-9">
      <span className="w-144 shrink-0">token</span>
      <span className="w-128 shrink-0">{value}</span>
      <span className="min-w-0 flex-1">{specimen}</span>
    </div>
  );
}


/** Stands where a drift table would, for a family that ships no token. */
export function NativeNote({ family }: { family: string }) {
  return (
    <Sheet>
      <p className="font-sans text-13/19 text-gray-11">
        <span className="font-mono text-12/17 text-gray-12">{family}</span> is Tailwind-native — no
        token. {NATIVE_FAMILIES[family]}
      </p>
      <p className="mt-8 font-sans text-12/17 text-gray-9">
        There is no drift to measure: the value exists once, at the call site.
      </p>
    </Sheet>
  );
}
