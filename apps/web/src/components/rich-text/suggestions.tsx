import type { SuggestionHooks } from '@tickets/richtext';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@tickets/ui/cn';

// RichTextEditor threads these two lookup sources through to the mention (@)
// and ticket-ref (#) Mention nodes wired in @tickets/richtext. Either source
// is optional — when absent, that trigger character simply never opens a
// popover (Suggestion's `items`/`render` hooks are never attached for it).
export type RichTextSuggestions = {
  users?: () => { id: number; label: string }[];
  tickets?: (query: string) => { id: number | null; label: string; title?: string }[];
};

type SuggestionItem = { id: number | null; label: string; title?: string };

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

  return (
    <div
      className="fixed z-50 min-w-45 rounded-[10px] border border-hairline bg-raised p-1 shadow-md"
      style={{ left: rect?.left ?? 0, top: rect?.bottom ?? 0 }}
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 font-sans text-ui text-ink-2">No matches</div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id ?? item.label}
            className={cn(
              'cursor-pointer rounded-md px-2 py-1.5 font-sans text-ui text-ink',
              index === selected && 'bg-accent-subtle text-ink',
            )}
            // Suggestion's mousedown-driven selection would otherwise blur the
            // editor before the click registers as a pick.
            onMouseDown={(event) => {
              event.preventDefault();
              command(item);
            }}
          >
            {/* The trigger char lives in its own node (not concatenated into
                the label's text node) so the label alone stays queryable by
                exact text — RTL's getByText only reads an element's direct
                text-node children, so `@beka` as a single string would never
                match a `'beka'` query. */}
            <span aria-hidden="true">{trigger}</span>
            <span>{item.label}</span>
            {trigger === '#' && item.title ? <span className="text-ink-2"> — {item.title}</span> : null}
          </div>
        ))
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
