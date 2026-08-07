import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CollectedDemo } from '@tickets/ui';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

export function highlightMatch(title: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return title;
  const i = title.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return title;
  return (
    <>
      {title.slice(0, i)}
      <strong className="font-600 text-indigo-9">{title.slice(i, i + q.length)}</strong>
      {title.slice(i + q.length)}
    </>
  );
}

export function CommandPalette({
  demos,
  open,
  onOpenChange,
  onSelect,
}: {
  demos: LiveDemo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Jump to a component. The shell owns how that reaches the URL. */
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState('');

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  // Close on Escape (Command.Dialog doesn't handle it in jsdom)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const groups = [...new Set(demos.map((d) => d.meta.group))];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="[&_[cmdk-dialog]]:fixed [&_[cmdk-dialog]]:inset-0 [&_[cmdk-dialog]]:flex [&_[cmdk-dialog]]:items-start [&_[cmdk-dialog]]:justify-center [&_[cmdk-dialog]]:bg-black/40 [&_[cmdk-dialog]]:pt-72"
    >
      <div className="w-520 rounded-12 border-1 border-gray-6 bg-surface-raised shadow-lg overflow-hidden">
        <div className="flex items-center gap-10 px-16 py-12 border-b-1 border-gray-6">
          <span className="text-11/13 tracking-wider text-gray-9">⌕</span>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder=""
            className="flex-1 bg-transparent text-13/19 text-gray-12 placeholder:text-gray-11 outline-none"
          />
          <span className="text-11/13 tracking-wider text-gray-9">Jump to component…</span>
        </div>

        <div className="py-8 px-6 flex flex-col max-h-384 overflow-y-auto">
          {groups.map((group) => {
            const groupDemos = demos.filter((d) => d.meta.group === group);
            return (
              <div key={group} className="flex flex-col">
                <Command.Group value={group}>
                  <div className="font-mono text-11/13 tracking-wider uppercase tracking-label text-gray-9 px-12 py-8">
                    {group}
                  </div>
                  {groupDemos.map((demo) => (
                    <Command.Item
                      key={demo.slug}
                      value={demo.slug}
                      onSelect={() => {
                        onSelect(demo.slug);
                        onOpenChange(false);
                      }}
                      className="h-34 px-12 py-0 flex items-center rounded-8 text-13/19 cursor-pointer data-[selected=true]:bg-indigo-3"
                    >
                      <span className="text-gray-11 data-[selected=true]:text-indigo-9">
                        {highlightMatch(demo.meta.title, query)}
                      </span>
                      <span className="flex-1" />
                      <span className="font-mono text-11/13 tracking-wider text-gray-9 data-[selected=true]:inline hidden">
                        ↵
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </div>
            );
          })}
        </div>

        <div className="flex items-center px-16 py-9 border-t-1 border-gray-6 bg-gray-1">
          <span className="font-mono text-11/13 tracking-wider text-gray-9">
            ↑↓ navigate · ↵ open · esc close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
