import { useState } from 'react';
import type { Board, UserKind } from '../../api/types';
import { useCreateUser } from '../../api/use-create-user';
import { Avatar } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
import { Combobox } from '../../ui/combobox';
import type { ComboOption } from '../../ui/combobox-list';
import { Input } from '../../ui/input';
import { RelativeDate } from '../../ui/relative-date';
import type { BoardIndexes } from '../../utils/index-board';

const KIND_OPTIONS: ComboOption[] = [
  { value: 'human', label: 'human' },
  { value: 'agent', label: 'agent' },
];

const GRID = 'grid-cols-[1.6fr_1.4fr_110px_130px]';

// TypeBadge-ish chip for the user kind; agents get the accent treatment the
// Avatar already uses so the two read as one system.
function KindChip({ kind }: { kind: UserKind }) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 shrink-0 items-center rounded-md px-2.25 font-mono text-[11px] font-medium',
        kind === 'agent' ? 'bg-accent-subtle text-accent' : 'border border-control text-ink-2',
      )}
    >
      {kind}
    </span>
  );
}

function ArchChip() {
  return (
    <span className="inline-flex h-[17px] shrink-0 items-center rounded-[4px] bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

// Workspace users roster + "new user" composer, per the fields-CRUD visual
// language of docs/design/06-settings-admin.html (table on a raised panel,
// uppercase label header, composer row). POST /api/users accepts only
// { name, kind } (docs/api/create-user.md) — email is response-only, so the
// composer deliberately has no email input.
export function UsersSettings({
  board,
}: {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
}) {
  const createUser = useCreateUser();

  const [composing, setComposing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [kind, setKind] = useState<UserKind>('human');
  const [error, setError] = useState('');

  // active first, archived at the end (stable within each group)
  const users = [...board.users].sort(
    (left, right) => Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt)),
  );
  const archivedCount = users.filter((user) => user.archivedAt).length;
  const countLabel =
    `${users.length} ${users.length === 1 ? 'user' : 'users'}` +
    (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

  const submit = async () => {
    setError('');
    const name = nameDraft.trim();
    if (name.length === 0) {
      return;
    }
    try {
      await createUser.mutateAsync({ name, kind });
      setNameDraft('');
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Users</h1>
        <span className="font-mono text-meta text-ink-3">{countLabel}</span>
        <span className="flex-1" />
        <Button variant="primary" className="h-8" onClick={() => setComposing((value) => !value)}>
          ＋ New user
        </Button>
      </div>

      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div
          className={cn(
            'grid h-9 items-center border-b border-hairline bg-app px-1',
            'font-sans text-label font-medium uppercase text-ink-2',
            GRID,
          )}
        >
          <span className="px-3">User</span>
          <span className="px-2">Email</span>
          <span className="px-2">Kind</span>
          <span className="px-2">Created</span>
        </div>

        {users.length === 0 ? (
          <p className="m-0 px-4 py-6 text-center font-sans text-meta text-ink-3">No users yet.</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className={cn(
                'grid h-11 items-center border-b border-hairline px-1',
                GRID,
                user.archivedAt && 'opacity-60',
              )}
            >
              <span className="flex min-w-0 items-center gap-2 px-3">
                <Avatar name={user.name} kind={user.kind} size="md" />
                <span className="truncate font-sans text-ui font-medium text-ink">{user.name}</span>
                {user.archivedAt ? <ArchChip /> : null}
              </span>
              <span className="min-w-0 truncate px-2 font-sans text-ui text-ink-3">
                {user.email ?? '—'}
              </span>
              <span className="px-2">
                <KindChip kind={user.kind} />
              </span>
              <span className="px-2">
                <RelativeDate value={user.createdAt} />
              </span>
            </div>
          ))
        )}

        {composing ? (
          <form
            className="flex flex-wrap items-center gap-1.5 bg-app px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              size="compact"
              className="w-44"
              placeholder="Name"
              aria-label="Name"
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <Combobox
              size="compact"
              className="w-32"
              options={KIND_OPTIONS}
              value={kind}
              onChange={(value) => setKind((value as UserKind | null) ?? 'human')}
            />
            <Button
              type="submit"
              variant="primary"
              size="compact"
              disabled={nameDraft.trim().length === 0 || createUser.isPending}
              loading={createUser.isPending}
            >
              Create user
            </Button>
            {error ? (
              <span className="font-sans text-meta text-danger">{error}</span>
            ) : (
              <span className="font-sans text-meta text-ink-3">
                name + kind only — the API doesn't accept email yet
              </span>
            )}
          </form>
        ) : null}
      </div>
    </section>
  );
}
