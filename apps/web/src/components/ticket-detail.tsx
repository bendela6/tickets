import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { useCurrentUser } from '../state/current-user-context';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu';
import { RelativeDate } from '../ui/relative-date';
import { StatusSelect } from '../ui/status-select';
import { TypeBadge } from '../ui/type-badge';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';
import { DetailActivity } from './detail-activity';
import { DetailChildren } from './detail-children';
import { DetailComments } from './detail-comments';
import { DetailFields } from './detail-fields';
import { DetailLinks } from './detail-links';
import { MarkdownEditor } from './markdown-editor';

const SECTION_LABEL = 'font-sans text-label font-medium uppercase text-ink-2';
const ICON_BUTTON =
  'inline-flex size-7.5 shrink-0 items-center justify-center rounded-[7px] border border-hairline ' +
  'bg-transparent text-ink-2 hover:bg-inset hover:text-ink';

function KeyChip({ prefix, number }: { prefix: string; number: number }) {
  return (
    <span className="shrink-0 rounded-ctrl bg-inset px-1.75 py-0.75 font-mono text-meta font-medium text-ink">
      {prefix}-{number}
    </span>
  );
}

// Click-to-edit title: static heading until clicked, then a borderless input
// that commits on blur/Enter and cancels on Escape.
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
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDraft(value)}
        className={cn(
          'm-0 w-full cursor-text border-b border-dashed border-transparent bg-transparent p-0',
          'text-left font-sans font-semibold text-ink enabled:hover:border-control',
          className,
        )}
      >
        {value.length > 0 ? value : 'Untitled'}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label="Title"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        setDraft(null);
        if (next.length > 0 && next !== value) {
          onSave(next);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.stopPropagation(); // cancel the edit without closing the drawer
          setDraft(null);
        }
      }}
      className={cn(
        'm-0 w-full border-b border-dashed border-accent bg-transparent p-0',
        'font-sans font-semibold text-ink outline-none',
        className,
      )}
    />
  );
}

// One detail model, two hosts: the drawer (peek) renders a single scroll
// stack; the dedicated page re-flows the same sections into a main column
// plus a right rail (field form + activity feed).
export function TicketDetail({
  projectKey,
  board,
  indexes,
  ticket,
  variant,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
  variant: 'drawer' | 'page';
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [copied, setCopied] = useState(false);

  const prefix = board.project.ticketPrefix;
  const type = indexes.typeById.get(ticket.typeId);
  const parent = ticket.parentId !== null ? indexes.ticketById.get(ticket.parentId) : null;
  const creator = indexes.userById.get(ticket.createdBy);
  const statusField = indexes.statusField;
  const rawStatus = statusField ? ticket.values[statusField.key] : undefined;
  const title = String(ticket.values['title'] ?? '');

  const typeFieldKeys = new Set(
    board.typeFields
      .filter((row) => row.ticketTypeId === ticket.typeId)
      .map((row) => indexes.fieldById.get(row.fieldId)?.key),
  );
  const descriptionField = typeFieldKeys.has('description')
    ? indexes.fieldByKey.get('description')
    : undefined;

  const openTicket = (ticketNumber: number) => {
    if (variant === 'page') {
      void navigate({
        to: '/p/$projectKey/t/$number',
        params: { projectKey, number: String(ticketNumber) },
      });
    } else {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, t: ticketNumber }),
      });
    }
  };

  const saveMutationOptions = {
    onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  };
  const saveValues = (values: Record<string, unknown>) => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        ticketId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
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
        ticketId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
        archived: ticket.archivedAt === null,
      },
      saveMutationOptions,
    );
  };

  const statusOptions = [...board.statuses]
    .filter((status) => !status.archivedAt)
    .sort((left, right) => left.position - right.position)
    .map((status) => ({ key: status.key, label: status.label, kind: status.kind }));
  const legalKeys = legalStatusTargets(board, indexes, ticket).map((status) => status.key);

  const archivedChip = ticket.archivedAt ? (
    <span className="shrink-0 rounded-ctrl bg-inset px-1.75 py-0.75 font-sans text-label font-medium text-ink-3">
      archived
    </span>
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
          {ticket.archivedAt ? 'Unarchive' : 'Archive'}
        </MenuItem>
      </MenuContent>
    </Menu>
  );

  const breadcrumb = parent ? (
    <button
      type="button"
      onClick={() => openTicket(parent.number)}
      className="flex w-fit min-w-0 items-center gap-1.5 bg-transparent p-0 text-left font-sans text-meta font-medium text-accent hover:underline"
    >
      <span aria-hidden>‹</span>
      <span className="shrink-0 font-mono">
        {prefix}-{parent.number}
      </span>
      <span className="truncate">{String(parent.values['title'] ?? '')}</span>
    </button>
  ) : null;

  const descriptionSection = descriptionField ? (
    <section>
      <div className={cn('mb-2', SECTION_LABEL)}>Description</div>
      <MarkdownEditor
        value={
          typeof ticket.values[descriptionField.key] === 'string'
            ? (ticket.values[descriptionField.key] as string)
            : ''
        }
        disabled={userId === null || patch.isPending}
        onSave={(next) => saveValues({ [descriptionField.key]: next.length > 0 ? next : null })}
      />
    </section>
  ) : null;

  const childrenSection =
    ticket.parentId === null ? (
      <DetailChildren
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        ticket={ticket}
        onOpenTicket={openTicket}
      />
    ) : null;

  const linksSection = (
    <DetailLinks board={board} indexes={indexes} ticket={ticket} onOpenTicket={openTicket} />
  );

  if (variant === 'drawer') {
    return (
      <>
        <div className="flex shrink-0 items-center gap-2.25 border-b border-hairline px-5 py-3.5">
          <KeyChip prefix={prefix} number={ticket.number} />
          <TypeBadge label={type?.label ?? '?'} />
          {statusField ? (
            <StatusSelect
              size="compact"
              className="w-auto"
              statuses={statusOptions}
              legalTargets={legalKeys}
              value={typeof rawStatus === 'string' ? rawStatus : null}
              disabled={userId === null}
              onChange={(next) => saveValues({ [statusField.key]: next })}
            />
          ) : null}
          {archivedChip}
          <span className="flex-1" />
          <Link
            to="/p/$projectKey/t/$number"
            params={{ projectKey, number: String(ticket.number) }}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-control bg-raised px-2.5 font-sans text-[12px] font-medium text-ink hover:bg-inset"
          >
            Open page ↗
          </Link>
          {archiveMenu}
          <button type="button" aria-label="Close" onClick={onClose} className={ICON_BUTTON}>
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto px-5 pb-6 pt-4.5">
          {breadcrumb}
          <InlineTitle
            value={title}
            disabled={userId === null}
            className="text-[18px] leading-[1.35]"
            onSave={(next) => saveValues({ title: next })}
          />
          <DetailFields board={board} indexes={indexes} ticket={ticket} layout="grid" />
          {descriptionSection}
          {childrenSection}
          {linksSection}
          <section>
            <div role="tablist" className="flex items-center gap-0.5 border-b border-hairline">
              {(['comments', 'activity'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={cn(
                    'px-3 py-2 font-sans text-[13px] capitalize',
                    tab === name
                      ? '-mb-px border-b-2 border-accent font-medium text-ink'
                      : 'text-ink-2 hover:text-ink',
                  )}
                >
                  {name}{' '}
                  {name === 'comments' ? (
                    <span className="font-mono text-[11px] text-ink-3">
                      {ticket.comments.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="pt-3">
              {tab === 'comments' ? (
                <DetailComments indexes={indexes} ticket={ticket} />
              ) : (
                <DetailActivity ticket={ticket} indexes={indexes} />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.25 border-b border-hairline py-3.5">
        <Link
          to="/p/$projectKey"
          params={{ projectKey }}
          className="shrink-0 font-sans text-meta text-ink-2 hover:text-ink"
        >
          {board.project.name}
        </Link>
        <span aria-hidden className="font-sans text-meta text-ink-3">
          ▸
        </span>
        <span className="shrink-0 font-mono text-meta font-medium text-ink">
          {prefix}-{ticket.number}
        </span>
        {archivedChip}
        <span className="flex-1" />
        <Button
          size="compact"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : '⧉ Copy link'}
        </Button>
        {archiveMenu}
      </div>
      <div className="flex gap-9 pb-10 pt-6.5">
        <div className="flex min-w-0 flex-1 flex-col gap-5.5">
          <div>
            {breadcrumb ? <div className="mb-2.5">{breadcrumb}</div> : null}
            <div className="mb-2.5 flex items-center gap-2.25">
              <KeyChip prefix={prefix} number={ticket.number} />
              <TypeBadge label={type?.label ?? '?'} />
              <span className="font-mono text-label text-ink-3">
                created{' '}
                <RelativeDate
                  value={ticket.createdAt}
                  className="font-mono text-[11px] text-ink-3"
                />{' '}
                by {creator?.name ?? `user ${ticket.createdBy}`}
              </span>
            </div>
            <InlineTitle
              value={title}
              disabled={userId === null}
              className="text-[24px] leading-[1.3]"
              onSave={(next) => saveValues({ title: next })}
            />
          </div>
          {descriptionSection}
          {childrenSection}
          {linksSection}
          <section>
            <div className={cn('mb-3', SECTION_LABEL)}>Comments</div>
            <DetailComments indexes={indexes} ticket={ticket} />
          </section>
        </div>
        <div className="flex w-80 shrink-0 flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-raised p-4">
            <div className={SECTION_LABEL}>Fields — {type?.label ?? '?'} form</div>
            <DetailFields board={board} indexes={indexes} ticket={ticket} layout="rail" />
          </section>
          <section>
            <div className={cn('mb-2.5', SECTION_LABEL)}>Activity</div>
            <DetailActivity ticket={ticket} indexes={indexes} />
          </section>
        </div>
      </div>
    </div>
  );
}
