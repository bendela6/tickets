import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCreateProject } from '../../api/use-create-project';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldLabel, Input } from '@tickets/ui';

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { userId } = useCurrentUser();
  const [draft, setDraft] = useState({ key: '', name: '', itemPrefix: '' });
  const valid =
    draft.key.trim() !== '' && draft.name.trim() !== '' && draft.itemPrefix.trim() !== '';

  async function submit() {
    if (userId === null) {
      return;
    }
    const created = await createProject.mutateAsync({
      actorId: userId,
      key: draft.key.trim(),
      name: draft.name.trim(),
      itemPrefix: draft.itemPrefix.trim().toUpperCase(),
    });
    onOpenChange(false);
    setDraft({ key: '', name: '', itemPrefix: '' });
    void navigate({ to: '/p/$projectKey', params: { projectKey: created.key } });
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New project</DialogTitle>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <FieldLabel htmlFor="np-name">Name</FieldLabel>
            <Input
              id="np-name"
              className="mt-1"
              placeholder="Gateway"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel htmlFor="np-key">Key</FieldLabel>
              <Input
                id="np-key"
                className="mt-1"
                placeholder="gateway"
                value={draft.key}
                onChange={(event) => setDraft({ ...draft, key: event.target.value })}
              />
            </div>
            <div className="w-32">
              <FieldLabel htmlFor="np-prefix">Prefix</FieldLabel>
              <Input
                id="np-prefix"
                className="mt-1 font-mono uppercase"
                placeholder="GW"
                value={draft.itemPrefix}
                onChange={(event) => setDraft({ ...draft, itemPrefix: event.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter cancel={<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>}>
          <Button
            variant="primary"
            disabled={!valid || userId === null}
            loading={createProject.isPending}
            onClick={() => void submit()}
          >
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
