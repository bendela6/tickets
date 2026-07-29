import type { SuggestionHooks } from '@tickets/richtext';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { StatusKind } from '../../api/types';
import { KIND_TONE } from '../../domain/status';
import { Avatar, cn, toneClasses } from '@tickets/ui';
import { avatarFor } from '../../domain/actor';

// RichTextEditor threads these two lookup sources through to the mention (@)
// and ticket-ref (#) Mention nodes wired in @tickets/richtext. Either source
// is optional — when absent, that trigger character simply never opens a
// popover (Suggestion's `items`/`render` hooks are never attached for it).
// `kind`/`statusKind` are optional too — board-suggestions.ts fills them in
// from the board index; a caller that can't derive them just gets the
// human/neutral row treatment.
export type RichTextSuggestions = {
  users?: () => { id: number; label: string; kind?: 'human' | 'agent' }[];
  tickets?: (
    query: string,
  ) => { id: number | null; label: string; title?: string; statusKind?: StatusKind | null }[];
};

type SuggestionItem = {
  id: number | null;
  label: string;
  title?: string;
  kind?: 'human' | 'agent';
  statusKind?: StatusKind | null;
};

// RichTextEditor.dc.html §04 "committed chips" derives initials from the
// full label ("Mara K." -> "MK"); the popover's trailing handle instead
// takes just the label's first word, lowercased ("Mara K." -> "@mara") — no
// separate handle field exists on the suggestion source, so this is the
// simplest honest derivation rather than inventing one.
function deriveHandle(label: string): string {
  const first = label.trim().split(/\s+/)[0] ?? '';
  return `@${first.toLowerCase()}`;
}

// Neutral fallback (same token the committed ticket-ref chip's dot uses,
// see `.rt [data-ticket-ref-dot]` in instrument.css) for rows whose source
// couldn't derive a real status kind. Sources its color from the app's ONE
// status→tone mapping (domain/status.ts) instead of a locally duplicated
// kind→class table.
function statusDotClass(kind: StatusKind | null | undefined): string {
  return toneClasses(kind ? KIND_TONE[kind] : 'gray', 'solid');
}

function PeopleRow({ item, selected }: { item: SuggestionItem; selected: boolean }) {
  const agent = item.kind === 'agent';
  return (
    <>
      <Avatar name={item.label} {...avatarFor(item.kind ?? 'human')} size="sm" />
      <span className="truncate font-sans text-13/19 font-500 text-gray-12">{item.label}</span>
      <span className="shrink-0 font-mono text-12/17 text-gray-9">{agent ? 'agent' : deriveHandle(item.label)}</span>
      <span className="flex-1" />
      {selected ? <span className="shrink-0 font-mono text-11 text-gray-9">↩</span> : null}
    </>
  );
}

function TicketRow({ item }: { item: SuggestionItem }) {
  return (
    <>
      <span className="shrink-0 rounded-md border-1 border-gray-6 bg-gray-1 px-1.5 py-0.5 font-mono text-11 font-500 text-gray-11">
        {item.label}
      </span>
      <span className="min-w-0 flex-1 truncate font-sans text-13/19 text-gray-12">{item.title}</span>
      <span className={cn('size-2 shrink-0 rounded-full', statusDotClass(item.statusKind))} />
    </>
  );
}

type SuggestionListProps = {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
  trigger: '@' | '#';
  rect: DOMRect | null;
};

type SuggestionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

// The popover. Mounted by ReactRenderer directly into document.body (see
// createSuggestionRender below) rather than positioned via tippy.js — jsdom
// has no layout, so `rect` is null in tests, which is exactly what pins the
// popover at left:0/top:0 and lets the suggestion tests find it by text.
const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(function SuggestionList(
  { items, command, trigger, rect },
  ref,
) {
  const [selected, setSelected] = useState(0);

  // A fresh query result resets the highlighted row — otherwise "selected"
  // could point past the end of a shorter items array.
  useEffect(() => {
    setSelected(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (items.length === 0) {
        return false;
      }
      if (event.key === 'ArrowDown') {
        setSelected((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelected((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selected];
        if (item) {
          command(item);
        }
        return true;
      }
      return false;
    },
  }));

  // RichTextEditor.dc.html §04: people popover is 272px, tickets 328px.
  const width = trigger === '@' ? 'w-68' : 'w-82';
  const sectionLabel = trigger === '@' ? 'PEOPLE' : 'TICKETS';

  return (
    <div
      className={cn(
        'fixed z-50 rounded-xl border-1 border-gray-6 bg-surface-raised p-1.25 shadow-lg',
        width,
      )}
      style={{ left: rect?.left ?? 0, top: rect?.bottom ?? 0 }}
    >
      {items.length === 0 ? (
        <div className="px-2.25 py-1.5 font-sans text-13/19 text-gray-11">No matches</div>
      ) : (
        <>
          <div className="px-2.25 pt-1.25 pb-1 font-mono text-10 font-500 tracking-widest text-gray-9">
            {sectionLabel}
          </div>
          {items.map((item, index) => {
            const isSelected = index === selected;
            return (
              <div
                key={item.id ?? item.label}
                className={cn(
                  'flex h-8.5 cursor-pointer items-center gap-2.25 rounded-md px-2.25',
                  isSelected ? 'bg-surface-inset' : 'hover:bg-gray-1',
                )}
                // Suggestion's mousedown-driven selection would otherwise blur
                // the editor before the click registers as a pick.
                onMouseDown={(event) => {
                  event.preventDefault();
                  command(item);
                }}
              >
                {trigger === '@' ? (
                  <PeopleRow item={item} selected={isSelected} />
                ) : (
                  <TicketRow item={item} />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
});

// Standard Tiptap suggestion render() protocol: onStart mounts the popover,
// onUpdate re-renders it with fresh items/position, onKeyDown delegates to
// the mounted list's imperative handle, onExit tears it down. One instance
// per keystroke-triggered suggestion session (per trigger character).
function createSuggestionRender(trigger: '@' | '#') {
  return () => {
    let component: ReactRenderer<SuggestionListHandle, SuggestionListProps> | null = null;

    return {
      onStart: (props: SuggestionProps<SuggestionItem>) => {
        component = new ReactRenderer(SuggestionList, {
          editor: props.editor,
          props: {
            items: props.items,
            command: props.command,
            trigger,
            rect: props.clientRect?.() ?? null,
          },
        });
        document.body.appendChild(component.element);
      },
      onUpdate: (props: SuggestionProps<SuggestionItem>) => {
        component?.updateProps({
          items: props.items,
          command: props.command,
          trigger,
          rect: props.clientRect?.() ?? null,
        });
      },
      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        if (props.event.key === 'Escape') {
          component?.destroy();
          component = null;
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        component?.destroy();
        component = null;
      },
    };
  };
}

function filterByLabel<T extends { label: string }>(query: string, items: T[]): T[] {
  const q = query.toLowerCase();
  return items.filter((item) => item.label.toLowerCase().includes(q));
}

// Maps RichTextSuggestions' plain lookup functions into the Mention nodes'
// suggestion configs. Only `items` and `render` are overridden — Mention's
// default `command` already inserts `{ type, attrs }` + a trailing space, and
// runs with whatever object the picked row's onClick/Enter hands it, which is
// the item itself ({ id, label, [title] }) here.
export function buildSuggestionHooks(suggestions?: RichTextSuggestions): SuggestionHooks {
  const hooks: SuggestionHooks = {};

  if (suggestions?.users) {
    const users = suggestions.users;
    hooks.mention = {
      items: ({ query }) => filterByLabel(query, users()),
      render: createSuggestionRender('@'),
    };
  }

  if (suggestions?.tickets) {
    const tickets = suggestions.tickets;
    hooks.ticketRef = {
      items: ({ query }) => tickets(query),
      render: createSuggestionRender('#'),
    };
  }

  return hooks;
}
