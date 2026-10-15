import { useState } from 'react';
import { useDisclosure } from '@bh/hooks';

// The page holds which sections are open, so it can open or fold them all;
// each section's hook shows `open` and asks `onOpenChange` for a change.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';
const SECTIONS = ['Shipping', 'Returns', 'Warranty'] as const;
type Section = (typeof SECTIONS)[number];

function Fold({
  name,
  open,
  onOpenChange,
}: {
  name: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fold = useDisclosure({ open, onOpenChange });
  return (
    <div className="flex flex-col gap-4">
      <button {...fold.getTriggerProps({ className: 'text-left font-500' })}>
        {fold.isOpen ? '▾' : '▸'} {name}
      </button>
      {/* Drawn only while open: aria-controls is set only then, so it never points at nothing. */}
      {fold.isOpen ? (
        <p {...fold.getRegionProps({ className: 'text-13/19 text-gray-11 pl-16' })}>
          What to know about {name.toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}

export function FoldedFromThePage() {
  const [open, setOpen] = useState<ReadonlySet<Section>>(() => new Set(['Shipping']));
  return (
    <div className="flex w-320 flex-col gap-8">
      <div className="flex gap-8">
        <button type="button" className={BUTTON} onClick={() => setOpen(new Set(SECTIONS))}>
          Open all
        </button>
        <button type="button" className={BUTTON} onClick={() => setOpen(new Set())}>
          Fold all
        </button>
      </div>
      {SECTIONS.map((name) => {
        return (
          <Fold
            key={name}
            name={name}
            open={open.has(name)}
            onOpenChange={(next) => {
              const sections = new Set(open);
              if (next) {
                sections.add(name);
              } else {
                sections.delete(name);
              }
              setOpen(sections);
            }}
          />
        );
      })}
    </div>
  );
}
