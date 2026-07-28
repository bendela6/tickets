import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pill } from '../components/pill';
import { SectionHeader } from '../components/section-header';
import { drift, driftSummary, type DriftStatus } from './spec';
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
    <div ref={ref} className="flex w-full flex-col gap-3">
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
    <div className={`flex gap-4 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <span className="w-36 shrink-0 font-mono text-meta font-500 text-gray-12">{name}</span>
      <span className="flex w-32 shrink-0 flex-col font-mono text-meta text-gray-9">
        <span>{value}</span>
        {note ? <span className="text-nano">{note}</span> : null}
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
    <div className="flex gap-4 font-mono text-nano uppercase tracking-widest text-gray-9">
      <span className="w-36 shrink-0">token</span>
      <span className="w-32 shrink-0">{value}</span>
      <span className="min-w-0 flex-1">{specimen}</span>
    </div>
  );
}

const STATUS_TONE: Record<DriftStatus, 'success' | 'primary' | 'warning'> = {
  matched: 'success',
  added: 'primary',
  dropped: 'warning',
};

/**
 * What changes if the proposed numbered set replaces what tokens.css ships.
 * Every foundation page ends with its own slice of this, because a view of a
 * token set that nothing consumes yet is only half the story — the other half
 * is which live token it lands on.
 */
export function DriftView({ families }: { families: string[] }) {
  const all = drift().filter((f) => families.includes(f.family));
  const counts = driftSummary(all);
  const cell = 'border-b border-gray-6 py-1.5 pr-4 text-left';
  return (
    <Sheet>
      <p className="font-sans text-meta text-gray-11">
        {counts.matched} proposed token{counts.matched === 1 ? '' : 's'} already exist under another
        name · {counts.added} would be added · {counts.dropped} live token
        {counts.dropped === 1 ? '' : 's'} would lose their value.
      </p>
      {all.map((family) => (
        <div key={family.family} className="flex flex-col gap-2">
          <SectionHeader title={family.family} count={`${family.rows.length}`} />
          {family.note ? (
            <p className="font-sans text-meta text-gray-9">{family.note}</p>
          ) : null}
          <table className="w-full border-collapse font-mono text-meta">
            <thead>
              <tr className="text-gray-9">
                <th className={`${cell} font-500`}>proposed</th>
                <th className={`${cell} font-500`}>live</th>
                <th className={`${cell} font-500`}>value</th>
                <th className="border-b border-gray-6 py-1.5 text-left font-500">status</th>
              </tr>
            </thead>
            <tbody>
              {family.rows.map((row) => (
                <tr key={`${row.spec ?? ''}-${row.live ?? ''}`} className="text-gray-12">
                  <td className={cell}>{row.spec ?? <span className="text-gray-9">—</span>}</td>
                  <td className={cell}>
                    {row.live ? `--${row.live}` : <span className="text-gray-9">—</span>}
                  </td>
                  <td className={`${cell} text-gray-11`}>{row.value}</td>
                  <td className="border-b border-gray-6 py-1.5">
                    <Pill label={row.status} tone={STATUS_TONE[row.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Sheet>
  );
}
