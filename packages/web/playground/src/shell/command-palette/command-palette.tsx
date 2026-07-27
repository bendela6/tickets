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
      <strong className="font-semibold text-indigo-9">{title.slice(i, i + q.length)}</strong>
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
      className="[&_[cmdk-dialog]]:fixed [&_[cmdk-dialog]]:inset-0 [&_[cmdk-dialog]]:flex [&_[cmdk-dialog]]:items-start [&_[cmdk-dialog]]:justify-center [&_[cmdk-dialog]]:bg-black/40 [&_[cmdk-dialog]]:pt-18"
    >
      <div className="w-130 rounded-xl border border-gray-6 bg-surface-raised shadow-lg overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-6">
          <span className="text-label text-gray-9">⌕</span>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder=""
            className="flex-1 bg-transparent text-ui text-gray-12 placeholder:text-gray-11 outline-none"
          />
          <span className="text-label text-gray-9">Jump to component…</span>
        </div>

        <div className="py-2 px-1.5 flex flex-col max-h-96 overflow-y-auto">
          {groups.map((group) => {
            const groupDemos = demos.filter((d) => d.meta.group === group);
            return (
              <div key={group} className="flex flex-col">
                <Command.Group value={group}>
                  <div className="font-mono text-label uppercase tracking-label text-gray-9 px-3 py-2">
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
                      className="h-8.5 px-3 py-0 flex items-center rounded-lg text-ui cursor-pointer data-[selected=true]:bg-indigo-3"
                    >
                      <span className="text-gray-11 data-[selected=true]:text-indigo-9">
                        {highlightMatch(demo.meta.title, query)}
                      </span>
                      <span className="flex-1" />
                      <span className="font-mono text-label text-gray-9 data-[selected=true]:inline hidden">
                        ↵
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </div>
            );
          })}
        </div>

        <div className="flex items-center px-4 py-2.25 border-t border-gray-6 bg-gray-1">
          <span className="font-mono text-label text-gray-9">
            ↑↓ navigate · ↵ open · esc close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
