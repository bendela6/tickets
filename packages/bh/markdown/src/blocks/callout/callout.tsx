import { parseDocument } from '../../parse';
import { renderNodes, useDocContext } from '../../render';
import { useMemo } from 'react';
import { cn } from '@bh/ui';
import type { CalloutData, CalloutType } from './schema';

/**
 * One shape, five levels. The level names itself in the kicker and colours the
 * frame, on the scale its tone resolves to: gray, green, indigo, orange, red.
 * Whole class strings per level, since Tailwind sees only whole names.
 */
const LEVELS: Record<CalloutType, { word: string; frame: string; kicker: string }> = {
  note: { word: 'Note', frame: 'border-gray-6 bg-gray-2', kicker: 'text-gray-11' },
  tip: { word: 'Tip', frame: 'border-green-6 bg-green-2', kicker: 'text-green-11' },
  important: {
    word: 'Important',
    frame: 'border-indigo-6 bg-indigo-2',
    kicker: 'text-indigo-11',
  },
  warning: { word: 'Warning', frame: 'border-orange-6 bg-orange-2', kicker: 'text-orange-11' },
  caution: { word: 'Caution', frame: 'border-red-6 bg-red-2', kicker: 'text-red-11' },
};

/** An aside in a page: its level, a title, and a markdown body drawn like the page around it. */
export function Callout({ data }: { data: CalloutData }) {
  const { registry, elements } = useDocContext();
  const nodes = useMemo(() => {
    return parseDocument(data.content, registry).nodes;
  }, [data.content, registry]);
  const level = LEVELS[data.type];

  return (
    <aside
      role="note"
      data-type={data.type}
      className={cn('rounded-6 mt-16 border-1 px-16 pt-12 pb-14 first:mt-0', level.frame)}
    >
      <p className={cn('text-11 font-600 tracking-[0.04em] uppercase', level.kicker)}>
        {level.word}
      </p>
      <p className="text-15/22 font-600 text-gray-12 mt-2">{data.title}</p>
      <div className="mt-4">{renderNodes(nodes, elements, 'callout')}</div>
    </aside>
  );
}
