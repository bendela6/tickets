import type { ReactNode } from 'react';

/**
 * One labelled block in the properties rail.
 *
 * The rail is quiet by construction: its ground is the app background, with no
 * card, no shadow and no accent rules. Groups are separated by a hairline and
 * a small uppercase label in tertiary text, and nothing else.
 */
export function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-9 border-b-1 border-gray-6 px-14 pb-14 pt-13">
      <h2 className="font-sans text-9 font-500 tracking-widest text-gray-9">{label}</h2>
      {children}
    </section>
  );
}
