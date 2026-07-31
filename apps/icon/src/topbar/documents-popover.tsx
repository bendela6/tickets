import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, cn } from '@tickets/ui';
import type { Documents } from './use-documents';
import { agoOf } from './use-documents';

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
        className="flex h-6.5 items-center gap-1.75 rounded-md px-2 hover:bg-surface-inset"
      >
        <span className="font-mono text-13 font-500 tracking-tight text-gray-12">{name}</span>
        <span
          aria-hidden
          className="size-0 flex-none border-x-4 border-t-4 border-x-transparent border-t-gray-9"
        />
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" className="w-62 p-0">
        <div className="flex items-center gap-2 border-b-1 border-gray-6 px-3 py-2.5">
          <span className="flex-1 font-sans text-11 font-500 text-gray-12">Documents</span>
        </div>

        <ul aria-label="Saved documents" className="p-1.5">
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
                    'flex h-9 w-full items-center gap-2.25 rounded-md px-2 text-left',
                    current && 'bg-surface-inset',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.25 flex-none rounded-full',
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
                      {summary.size} × {summary.size} · {agoOf(summary.updatedAt, now)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-1.5 pb-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              documents.create();
              setOpen(false);
            }}
            className="flex h-7.5 w-full items-center justify-center gap-1.5 rounded-md border-1 border-dashed border-gray-7 font-mono text-11 text-gray-11"
          >
            + new icon
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
