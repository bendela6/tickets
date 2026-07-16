import { useState } from 'react';
import { useCreateUser } from '../../api/use-create-user';
import { useUsers } from '../../api/use-users';
import { useCurrentUser } from '../../state/current-user-context';
import { Avatar } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { DialogContent, DialogRoot, DialogTitle } from '../../ui/dialog';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../ui/menu';

// Sidebar footer card: who edits are attributed to. Design 01 §sidebar footer.
export function ActorMenu() {
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
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[8px] border border-hairline bg-raised px-2 py-1.5 text-left hover:border-control"
          >
            {current ? (
              <Avatar
                name={current.name}
                kind={current.kind === 'agent' ? 'agent' : 'human'}
                size="md"
              />
            ) : (
              <span className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-full bg-inset font-sans text-[10px] text-ink-3">
                ?
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-sans text-meta font-medium text-ink">
                {current ? current.name : 'Pick a user'}
              </span>
              <span className="font-mono text-[10px] text-ink-3">acting as</span>
            </span>
            <span aria-hidden className="text-[10px] text-ink-3">
              ⇅
            </span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" side="top">
          {active.map((user) => (
            <MenuItem key={user.id} onSelect={() => setUserId(user.id)}>
              <span className="inline-flex items-center gap-2">
                <Avatar name={user.name} kind={user.kind === 'agent' ? 'agent' : 'human'} />
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
          <div className="mt-4">
            <FieldLabel htmlFor="nu-name">Name</FieldLabel>
            <Input
              id="nu-name"
              className="mt-1"
              placeholder="Mara K."
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
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
