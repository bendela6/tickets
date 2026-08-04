import { useState } from 'react';
import { useCreateUser } from '../../api/use-create-user';
import { useUsers } from '../../api/use-users';
import { useCurrentUser } from '../../state/current-user-context';
import { Avatar, Button, DialogContent, DialogRoot, DialogTitle, FieldLabel, Input, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@tickets/ui';
import { avatarFor } from '../../domain/actor';

// Sidebar footer card: who edits are attributed to. Design 01 §sidebar footer.
// `compact` renders just the avatar (for the 48px activity rail) instead of
// the full bordered card with name + "acting as" + ⇅ glyph — same menu either way.
export function ActorMenu({ compact = false }: { compact?: boolean } = {}) {
  const users = useUsers();
  const createUser = useCreateUser();
  const { userId, setUserId } = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const active = (users.data?.data ?? []).filter((user) => !user.archivedAt);
  const current = active.find((user) => user.id === userId) ?? null;

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          {compact ? (
            <button
              type="button"
              aria-label={current ? `Acting as ${current.name}` : 'Pick a user'}
              title={current ? `Acting as ${current.name}` : 'Pick a user'}
              className="flex size-36 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-surface-inset"
            >
              {current ? (
                <Avatar
                  name={current.name} {...avatarFor(current.kind === 'agent' ? 'agent' : 'human')}
                  size="md"
                />
              ) : (
                <span className="inline-flex size-22 shrink-0 items-center justify-center rounded-full bg-surface-inset font-sans text-10 text-gray-9">
                  ?
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-8 rounded-lg border-1 border-gray-6 bg-surface-raised px-8 py-6 text-left hover:border-gray-7"
            >
              {current ? (
                <Avatar
                  name={current.name} {...avatarFor(current.kind === 'agent' ? 'agent' : 'human')}
                  size="md"
                />
              ) : (
                <span className="inline-flex size-22 shrink-0 items-center justify-center rounded-full bg-surface-inset font-sans text-10 text-gray-9">
                  ?
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-sans text-12/17 font-500 text-gray-12">
                  {current ? current.name : 'Pick a user'}
                </span>
                <span className="font-mono text-10 text-gray-9">acting as</span>
              </span>
              <span aria-hidden className="text-10 text-gray-9">
                ⇅
              </span>
            </button>
          )}
        </MenuTrigger>
        <MenuContent align="start" side="top">
          {active.map((user) => (
            <MenuItem key={user.id} onSelect={() => setUserId(user.id)}>
              <span className="inline-flex items-center gap-8">
                <Avatar name={user.name} {...avatarFor(user.kind === 'agent' ? 'agent' : 'human')} />
                {user.name}
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => setCreating(true)}>＋ New user…</MenuItem>
        </MenuContent>
      </Menu>

      <DialogRoot open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogTitle>New user</DialogTitle>
          <div className="mt-16">
            <FieldLabel htmlFor="nu-name">Name</FieldLabel>
            <Input
              id="nu-name"
              className="mt-4"
              placeholder="Mara K."
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </div>
          <div className="mt-20 flex justify-end gap-8">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              disabled={nameDraft.trim() === '' || userId === null}
              loading={createUser.isPending}
              onClick={async () => {
                if (userId === null) {
                  return;
                }
                const created = await createUser.mutateAsync({
                  actorId: userId,
                  name: nameDraft.trim(),
                });
                setUserId(created.id);
                setCreating(false);
                setNameDraft('');
              }}
            >
              Add user
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
