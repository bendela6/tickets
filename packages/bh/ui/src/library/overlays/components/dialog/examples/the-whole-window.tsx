import { useState } from 'react';
import { Button, DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from '@bh/ui';

const SECTIONS = [
  {
    title: 'Shelving',
    text: 'Stand books upright, with neighbours of the same height, so none leans. A shelf packed tight scuffs the spines as a book comes out; leave a finger’s width at the end.',
  },
  {
    title: 'Light',
    text: 'Sunlight fades a spine in a summer. Keep the shelves out of it, and draw the blind on the side of the room it comes from.',
  },
  {
    title: 'Air',
    text: 'Paper takes in damp and gives it back. A room that is comfortable to sit in is right for books too: not by a radiator, and never against an outside wall.',
  },
  {
    title: 'Handling',
    text: 'Take a book out by its middle, never by the top of the spine. Open an old one only as far as it opens by itself, and rest it on a cushion to read.',
  },
  {
    title: 'Dust',
    text: 'Brush the top edge away from the spine with a soft brush, a shelf at a time, twice a year. A damp cloth does more harm than the dust.',
  },
  {
    title: 'Repairs',
    text: 'Tape yellows and lifts in a few years, taking the paper with it. Keep a loose page in place with a slip of acid-free paper, and leave the mending to a binder.',
  },
];

export function TheWholeWindow() {
  const [open, setOpen] = useState(false);
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Read the guide</Button>
      </DialogTrigger>
      <DialogContent size="fullscreen" aria-describedby={undefined}>
        <header className="border-gray-6 flex h-48 shrink-0 items-center gap-12 border-b-1 pr-8 pl-16">
          <DialogTitle className="min-w-0 flex-1 truncate">Caring for old books</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" tone="neutral" size="sm" icon="x" label="Close" />
          </DialogClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-560 flex-col gap-24 px-16 py-32">
            {SECTIONS.map((section) => {
              return (
                <section key={section.title} className="flex flex-col gap-6">
                  <h3 className="text-14 font-600">{section.title}</h3>
                  <p className="text-13/19 text-gray-11">{section.text}</p>
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
