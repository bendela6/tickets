import { useState } from 'react';
import { useScrollSpy } from '@bh/hooks';

const SECTIONS = [
  {
    id: 'sowing',
    title: 'Sowing',
    text: 'Sow hardy seeds outside once the soil crumbles in the hand, and tender ones on a windowsill six weeks before the last frost.',
  },
  {
    id: 'watering',
    title: 'Watering',
    text: 'Water the roots, not the leaves, in the morning or the evening, and less often but deeply, so the roots go down after it.',
  },
  {
    id: 'pruning',
    title: 'Pruning',
    text: 'Cut back to just above a bud that faces out, with a clean slanting cut, so the rain runs off and the new shoot grows away from the middle.',
  },
  {
    id: 'harvest',
    title: 'Harvest',
    text: 'Pick in the cool of the morning, and pick often: a plant that is picked keeps flowering and fruiting.',
  },
  {
    id: 'winter',
    title: 'Winter',
    text: 'Leave the seed heads for the birds, mulch the beds, and wrap the pots that would crack in a frost.',
  },
];

const IDS = SECTIONS.map((section) => section.id);

export function AnOutlineThatFollows() {
  // The box the sections scroll in, kept in state: null until it is on the page.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const { activeId, pin } = useScrollSpy(IDS, { root, offset: 24 });

  return (
    <div className="flex w-full max-w-560 gap-16">
      <nav aria-label="The garden year" className="flex w-112 shrink-0 flex-col">
        {SECTIONS.map((section) => {
          const active = section.id === activeId;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                // Lit at once, and kept lit while the box scrolls to it.
                pin(section.id);
                const target = document.getElementById(section.id);
                if (root && target) {
                  root.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
                }
              }}
              className={
                active
                  ? 'text-13 font-500 text-gray-12 border-indigo-9 border-l-2 py-4 pl-10'
                  : 'text-13 text-gray-11 hover:text-gray-12 border-l-2 border-transparent py-4 pl-10'
              }
            >
              {section.title}
            </a>
          );
        })}
      </nav>
      <div
        ref={setRoot}
        className="border-gray-6 rounded-8 relative h-240 min-w-0 flex-1 overflow-y-auto border-1 p-16"
      >
        {SECTIONS.map((section) => {
          return (
            <section key={section.id} id={section.id} className="flex flex-col gap-6 pb-32">
              <h3 className="text-14 font-600 text-gray-12">{section.title}</h3>
              <p className="text-13/19 text-gray-11">{section.text}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
