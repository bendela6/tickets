import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Item } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { typePill } from '../domain/status';
import { statusChoices } from '../domain/status-choices';
import { useCurrentUser } from '../state/current-user-context';
import { Button, cn, Combobox, DrawerControls, Icon, Input, Menu, MenuContent, MenuItem, MenuTrigger, Pill, RelativeDate, SectionHeader, Tabs, useCopy } from '@bh/ui';
import { ItemKey } from './item-key';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';
import { DetailActivity } from './detail-activity';
import { DetailChildren } from './detail-children';
import { DetailComments } from './detail-comments';
import { DetailFields } from './detail-fields';
import { DetailLinks } from './detail-links';
import { boardSuggestions } from './rich-text/board-suggestions';
import { RichTextEditor } from './rich-text/rich-text-editor';

const ICON_BUTTON =
  'inline-flex size-30 shrink-0 items-center justify-center rounded-8 border-1 border-gray-6 ' +
  'bg-transparent text-gray-11 hover:bg-surface-inset hover:text-gray-12';

// Click-to-edit title: static heading until clicked, then bh's Input holding
// the draft (`commit="leave"`): leaving the field or Enter saves it, Escape
// drops it (and in the drawer closes the drawer too, as it always has).
// Either way the heading returns.
function InlineTitle({
  value,
  disabled,
  className,
  onSave,
}: {
  value: string;
  disabled: boolean;
  className?: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // Whether Escape dropped this edit's draft. In the drawer the dialog hears
  // Escape first (on the document, capturing) and closes, and the Input
  // commits a draft it still holds as it unmounts: the edit Escape dropped
  // would be saved. The window hears the key before the document does, so it
  // is noted there and that commit refused.
  const dropped = useRef(false);
  useEffect(() => {
    if (!editing) {
      return;
    }
    dropped.current = false;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && event.target === field.current) {
        dropped.current = true;
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={cn(
          'm-0 w-full cursor-text border-b-1 border-dashed border-transparent bg-transparent p-0',
          'text-left font-sans font-600 text-gray-12 enabled:hover:border-gray-7',
          className,
        )}
      >
        {value.length > 0 ? value : 'Untitled'}
      </button>
    );
  }
  // The field's floor and padding around the title's own type, pulled out by
  // its padding and border so the words stay where the heading had them.
  return (
    <div className="-mx-9 -my-5">
      <Input
        ref={field}
        autoFocus
        aria-label="Title"
        commit="leave"
        value={value}
        onChange={(next) => {
          const title = next.trim();
          if (!dropped.current && title.length > 0 && title !== value) {
            onSave(title);
          }
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          // The Input has already saved on Enter and put the title back on
          // Escape; this only leaves the field.
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setEditing(false);
          }
        }}
        className={cn('h-auto px-8 py-4 font-600', className)}
      />
    </div>
  );
}

// One detail model, two hosts: the drawer (peek) renders a single scroll
// stack; the dedicated page re-flows the same sections into a main column
// plus a right rail (field form + activity feed).
export function ItemDetail({
  projectKey,
  board,
  indexes,
  item,
  variant,
  onOpenItem,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  variant: 'drawer' | 'page';
  /** Opens another item of this board by its key. A host that keeps the open
   *  item in its own state, not in the URL's `t`, passes its own. */
  onOpenItem?: (itemKey: string) => void;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const { copied, copy: copyLink } = useCopy();

  const type = indexes.typeById.get(item.typeId);
  const parent = item.parentId !== null ? indexes.itemById.get(item.parentId) : null;
  const creator = indexes.userById.get(item.createdBy);
  const workflowField = indexes.workflowField(item.typeId);
  const rawStatus = workflowField ? item.values[workflowField.key] : undefined;
  const title = String(item.values['title'] ?? '');

  const typeFieldKeys = new Set(
    (indexes.placementsByType.get(item.typeId) ?? []).map(
      (placement) => indexes.fieldById.get(placement.fieldId)?.key,
    ),
  );
  const descriptionField = typeFieldKeys.has('description')
    ? indexes.fieldByKey.get('description')
    : undefined;

  const openItem =
    onOpenItem ??
    ((itemKey: string) => {
      if (variant === 'page') {
        void navigate({
          to: '/p/$projectKey/t/$itemKey',
          params: { projectKey, itemKey },
        });
      } else {
        void navigate({
          to: '.',
          search: (previous: Record<string, unknown>) => ({ ...previous, t: itemKey }),
        });
      }
    });

  const saveMutationOptions = {
    onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  };
  const saveValues = (values: Record<string, unknown>) => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        itemId: item.id,
        actorId: userId,
        expectedUpdatedAt: item.updatedAt,
        values,
      },
      saveMutationOptions,
    );
  };
  const toggleArchived = () => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        itemId: item.id,
        actorId: userId,
        expectedUpdatedAt: item.updatedAt,
        archived: item.archivedAt === null,
      },
      saveMutationOptions,
    );
  };

  const statusValue = typeof rawStatus === 'string' ? rawStatus : null;
  const statuses = workflowField
    ? indexes.optionsForField(item.typeId, workflowField).filter((option) => !option.archivedAt)
    : [];
  const legalStatuses = legalStatusTargets(board, indexes, item, item.typeId);
  const setStatus = (next: string | null) => {
    if (userId === null || !workflowField || next === null) {
      return;
    }
    patch.mutate(
      {
        itemId: item.id,
        actorId: userId,
        expectedUpdatedAt: item.updatedAt,
        values: { [workflowField.key]: next },
      },
      // A rejected move (422) is toasted by MutationErrorToasts like any
      // other failed save.
      saveMutationOptions,
    );
  };

  const archivedChip = item.archivedAt ? (
    <Pill tone="secondary" label="archived" className="rounded-6 text-11/13 tracking-wider text-gray-9" />
  ) : null;

  const archiveMenu = (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" aria-label="More actions" className={ICON_BUTTON}>
          ⋯
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem disabled={userId === null} onSelect={toggleArchived}>
          {item.archivedAt ? 'Unarchive' : 'Archive'}
        </MenuItem>
      </MenuContent>
    </Menu>
  );

  const breadcrumb = parent ? (
    <button
      type="button"
      onClick={() => openItem(parent.key)}
      className="flex w-fit min-w-0 items-center gap-6 bg-transparent p-0 text-left font-sans text-12/17 font-500 text-indigo-9 hover:underline"
    >
      <span aria-hidden>‹</span>
      <span className="shrink-0 font-mono">{parent.key}</span>
      <span className="truncate">{String(parent.values['title'] ?? '')}</span>
    </button>
  ) : null;

  const descriptionSection = descriptionField ? (
    <section>
      <SectionHeader title="Description" className="mb-8" />
      <RichTextEditor
        value={
          typeof item.values[descriptionField.key] === 'string'
            ? (item.values[descriptionField.key] as string)
            : ''
        }
        disabled={userId === null || patch.isPending}
        features="full"
        suggestions={boardSuggestions(indexes)}
        onSave={(next) => saveValues({ [descriptionField.key]: next.length > 0 ? next : null })}
      />
    </section>
  ) : null;

  const childrenSection =
    item.parentId === null ? (
      <DetailChildren
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        item={item}
        onOpenItem={openItem}
      />
    ) : null;

  const linksSection = (
    <DetailLinks board={board} indexes={indexes} item={item} onOpenItem={openItem} />
  );

  if (variant === 'drawer') {
    return (
      <>
        <div className="flex shrink-0 items-center gap-9 border-b-1 border-gray-6 px-20 py-14">
          <ItemKey itemKey={item.key} className="shrink-0 rounded-6 bg-surface-inset px-7 py-3" />
          <Pill {...typePill} label={type?.label ?? '?'} />
          {workflowField ? (
            <Combobox
              size="xs"
              className="w-176"
              aria-label="Status"
              searchable={false}
              placeholder="Set status…"
              {...statusChoices(statuses, legalStatuses, statusValue)}
              value={statusValue}
              disabled={userId === null}
              onChange={setStatus}
            />
          ) : null}
          {archivedChip}
          <span className="flex-1" />
          <Link
            to="/p/$projectKey/t/$itemKey"
            params={{ projectKey, itemKey: item.key }}
            className="inline-flex h-28 shrink-0 items-center gap-4 rounded-6 border-1 border-gray-7 bg-surface-raised px-10 font-sans text-12 font-500 text-gray-12 hover:bg-surface-inset"
          >
            Open page ↗
          </Link>
          {archiveMenu}
          <DrawerControls />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-18 overflow-y-auto px-20 pb-24 pt-18">
          {breadcrumb}
          <InlineTitle
            value={title}
            disabled={userId === null}
            className="text-18 leading-[1.35]"
            onSave={(next) => saveValues({ title: next })}
          />
          <DetailFields board={board} indexes={indexes} item={item} layout="grid" />
          {descriptionSection}
          {childrenSection}
          {linksSection}
          <section>
            <Tabs
              items={[
                { value: 'comments', label: 'Comments', badge: item.comments.length },
                { value: 'activity', label: 'Activity' },
              ]}
              value={tab}
              onChange={(next) => setTab(next as typeof tab)}
            />
            <div className="pt-12">
              {tab === 'comments' ? (
                <DetailComments indexes={indexes} item={item} onOpenItem={openItem} />
              ) : (
                <DetailActivity item={item} indexes={indexes} />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-9 border-b-1 border-gray-6 py-14">
        <Link
          to="/p/$projectKey"
          params={{ projectKey }}
          className="shrink-0 font-sans text-12/17 text-gray-11 hover:text-gray-12"
        >
          {board.project.name}
        </Link>
        <span aria-hidden className="font-sans text-12/17 text-gray-9">
          <Icon name="chevron-right" size="2xs" />
        </span>
        <span className="shrink-0 font-mono text-12/17 font-500 text-gray-12">{item.key}</span>
        {archivedChip}
        <span className="flex-1" />
        <Button size="sm" onClick={() => void copyLink(window.location.href)}>
          {copied ? 'Copied' : '⧉ Copy link'}
        </Button>
        {archiveMenu}
      </div>
      <div className="flex gap-36 pb-40 pt-26">
        <div className="flex min-w-0 flex-1 flex-col gap-22">
          <div>
            {breadcrumb ? <div className="mb-10">{breadcrumb}</div> : null}
            <div className="mb-10 flex items-center gap-9">
              <ItemKey itemKey={item.key} className="shrink-0 rounded-6 bg-surface-inset px-7 py-3" />
              <Pill {...typePill} label={type?.label ?? '?'} />
              <span className="font-mono text-11/13 tracking-wider text-gray-9">
                created{' '}
                <RelativeDate value={item.createdAt} className="font-mono text-11 text-gray-9" />{' '}
                by {creator?.name ?? `user ${item.createdBy}`}
              </span>
            </div>
            <InlineTitle
              value={title}
              disabled={userId === null}
              className="text-24 leading-[1.3]"
              onSave={(next) => saveValues({ title: next })}
            />
          </div>
          {descriptionSection}
          {childrenSection}
          {linksSection}
          <section>
            <SectionHeader title="Comments" className="mb-12" />
            <DetailComments indexes={indexes} item={item} onOpenItem={openItem} />
          </section>
        </div>
        <div className="flex w-320 shrink-0 flex-col gap-20">
          <section className="flex flex-col gap-12 rounded-12 border-1 border-gray-6 bg-surface-raised p-16">
            <SectionHeader title={`Fields — ${type?.label ?? '?'} form`} />
            <DetailFields board={board} indexes={indexes} item={item} layout="rail" />
          </section>
          <section>
            <SectionHeader title="Activity" className="mb-10" />
            <DetailActivity item={item} indexes={indexes} />
          </section>
        </div>
      </div>
    </div>
  );
}
