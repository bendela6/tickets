import { useState } from 'react';
import { Button, Disclosure } from '@bh/ui';

const SECTIONS = [
  { key: 'size', title: 'Size', summary: '1280 by 720' },
  { key: 'colour', title: 'Colour', summary: 'sRGB, 8 bits' },
];

export function Controlled() {
  const [open, setOpen] = useState<Record<string, boolean>>({ size: true, colour: false });
  const all = (to: boolean) => setOpen({ size: to, colour: to });
  return (
    <div className="flex w-400 max-w-full flex-col gap-8">
      <div className="flex gap-8">
        <Button size="sm" variant="ghost" tone="neutral" onClick={() => all(true)}>
          Open all
        </Button>
        <Button size="sm" variant="ghost" tone="neutral" onClick={() => all(false)}>
          Fold all
        </Button>
      </div>
      {SECTIONS.map((section) => {
        return (
          <Disclosure
            key={section.key}
            title={section.title}
            summary={section.summary}
            rule
            open={open[section.key] ?? false}
            onOpenChange={(next) => setOpen({ ...open, [section.key]: next })}
          >
            <p className="text-13/19 text-gray-11">The {section.title.toLowerCase()} settings.</p>
          </Disclosure>
        );
      })}
    </div>
  );
}
