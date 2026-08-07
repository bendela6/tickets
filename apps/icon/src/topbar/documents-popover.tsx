import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, cn } from '@tickets/ui';
import type { Documents } from './use-documents';
import { agoOf } from './use-documents';

/**
 * The footer's two actions — start an icon, or bring one in — which read as a
 * pair and so are shaped once. `.popover-action` carries the corner: one of
 * them is a `<button>` and the other a `<label>` wrapping a file input, so a
 * shared component is not available to them, but a shared class is.
 */
const ACTION =
  'popover-action flex h-30 flex-1 items-center justify-center gap-6 border-1 border-dashed border-gray-7 font-mono text-11 text-gray-11';

/**
 * The document name was already in the top bar, so it becomes the control
 * rather than gaining one. No rail, no launcher, no file menu.
 */
export function DocumentsPopover({
  name,
  documents,
  now,
}: {
  name: string;
  documents: Documents;
  now: number;
}) {
  // Controlled, because choosing a document is the end of the interaction:
  // leaving the list open over the document it just opened would make the
  // next click on the trigger read as "close" when it means "choose again".
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Documents"
        title="Documents"
        className="flex h-26 items-center gap-7 rounded-6 px-8 hover:bg-surface-inset"
      >
        <span className="font-mono text-13 font-500 tracking-tight text-gray-12">{name}</span>
        <span
          aria-hidden
          className="size-0 flex-none border-x-4 border-t-4 border-x-transparent border-t-gray-9"
        />
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" className="w-248 p-0">
        <div className="flex items-center gap-8 border-b-1 border-gray-6 px-12 py-10">
          <span className="flex-1 font-sans text-11 font-500 text-gray-12">Documents</span>
        </div>

        <ul aria-label="Saved documents" className="p-6">
          {documents.list.map((summary) => {
            const current = summary.id === documents.currentId;
            return (
              <li key={summary.id}>
                <button
                  type="button"
                  aria-current={current || undefined}
                  onClick={() => {
                    documents.open(summary.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex h-36 w-full items-center gap-9 rounded-6 px-8 text-left',
                    current && 'bg-surface-inset',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-5 flex-none rounded-full',
                      current ? 'bg-gray-12' : 'bg-transparent',
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span
                      className={cn(
                        'truncate font-mono text-12',
                        current ? 'font-500 text-gray-12' : 'text-gray-11',
                      )}
                    >
                      {summary.name}
                    </span>
                    <span className="font-mono text-9 text-gray-9">
                      {summary.artboard.width} × {summary.artboard.height} · {agoOf(summary.updatedAt, now)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-6 px-6 pb-8 pt-2">
          <button
            type="button"
            onClick={() => {
              documents.create();
              setOpen(false);
            }}
            className={ACTION}
          >
            + new icon
          </button>

          {/* A label rather than a button: a file picker opens from a file
              input and from nothing else. It is out of sight but not out of
              the accessibility tree, which is where its name lives. */}
          <label className={cn(ACTION, 'cursor-pointer')}>
            ↑ import svg
            <input
              type="file"
              aria-label="Import SVG"
              accept=".svg,image/svg+xml"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so picking the same file twice in a row is two
                // imports rather than one: without it the second choice is not
                // a change, and no event arrives.
                event.target.value = '';
                if (!file) return;
                documents.importFile(file);
                setOpen(false);
              }}
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
