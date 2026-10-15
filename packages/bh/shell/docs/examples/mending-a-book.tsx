import { useState } from 'react';
import { OnThisPage, type PageSection } from '@bh/shell/layout';

interface Part extends PageSection {
  text: string;
}

// Each section's level is its heading's: h3s, with two h4s under A broken spine.
const PARTS: readonly Part[] = [
  {
    id: 'mending-loose-pages',
    label: 'Loose pages',
    level: 3,
    text: 'Tip a loose page back in with a thin line of paste along its inner edge, and close the book on it under a weight overnight.',
  },
  {
    id: 'mending-a-torn-page',
    label: 'A torn page',
    level: 3,
    text: 'Lay the tear on a sheet of blotting paper, ease its edges together, and bridge it with a strip of tissue and wheat starch.',
  },
  {
    id: 'mending-a-broken-spine',
    label: 'A broken spine',
    level: 3,
    text: 'A spine that has split down a joint can be mended two ways, by how much of the cover is still sound.',
  },
  {
    id: 'mending-rebacking',
    label: 'Rebacking',
    level: 4,
    text: 'Lift the old spine, line the joints with new cloth, and lay the old spine back over it, so the book keeps its own face.',
  },
  {
    id: 'mending-recasing',
    label: 'Recasing',
    level: 4,
    text: 'When the boards have come away, take the text block out, give it new mull and endpapers, and hang it back in its case.',
  },
  {
    id: 'mending-cleaning',
    label: 'Cleaning',
    level: 3,
    text: 'Brush the dust from the head of the book first, away from the spine, and lift a mark with a soft eraser, never a wet cloth.',
  },
];

export function MendingABook() {
  // The box the guide scrolls in, kept in state: null until it is on the page.
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex w-full max-w-640 gap-16">
      <div
        ref={setBox}
        className="border-gray-6 rounded-8 h-280 min-w-0 flex-1 overflow-y-auto border-1 px-16"
      >
        {PARTS.map((part) => {
          const Heading = part.level === 4 ? 'h4' : 'h3';
          return (
            <section key={part.id} id={part.id} className="flex flex-col gap-6 py-16">
              <Heading
                className={
                  part.level === 4
                    ? 'text-13 font-600 text-gray-12'
                    : 'text-15 font-600 text-gray-12'
                }
              >
                {part.label}
              </Heading>
              <p className="text-13/19 text-gray-11">{part.text}</p>
            </section>
          );
        })}
      </div>
      <div className="w-200 shrink-0">
        <OnThisPage sections={PARTS} root={box} offset={24} label="Mending" />
      </div>
    </div>
  );
}
