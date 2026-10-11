import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { OWN_ERROR } from '../../api/mutation-meta';
import { useCreateProject } from '../../api/use-create-project';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldError, FieldLabel, Input } from '@bh/ui';

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useCreateProject(OWN_ERROR);
  const { userId } = useCurrentUser();
  const [draft, setDraft] = useState({ key: '', name: '', itemPrefix: '' });
  const valid =
    draft.key.trim() !== '' && draft.name.trim() !== '' && draft.itemPrefix.trim() !== '';

  async function submit() {
    if (userId === null) {
      return;
    }
    const key = draft.key.trim();
    try {
      await createProject.mutateAsync({
        actorId: userId,
        key,
        name: draft.name.trim(),
        itemPrefix: draft.itemPrefix.trim().toUpperCase(),
      });
    } catch {
      return; // shown under the fields; the dialog stays open to fix it
    }
    onOpenChange(false);
    setDraft({ key: '', name: '', itemPrefix: '' });
    // The API answers with the id alone, so the page opens on the key we sent.
    void navigate({ to: '/p/$projectKey', params: { projectKey: key } });
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) createProject.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>New project</DialogTitle>
        <div className="mt-16 flex flex-col gap-12">
          <div>
            <FieldLabel htmlFor="np-name">Name</FieldLabel>
            <Input
              id="np-name"
              className="mt-4"
              placeholder="Gateway"
              value={draft.name}
              onChange={(next) => setDraft({ ...draft, name: next })}
            />
          </div>
          <div className="flex gap-12">
            <div className="flex-1">
              <FieldLabel htmlFor="np-key">Key</FieldLabel>
              <Input
                id="np-key"
                className="mt-4"
                placeholder="gateway"
                value={draft.key}
                onChange={(next) => setDraft({ ...draft, key: next })}
              />
            </div>
            <div className="w-128">
              <FieldLabel htmlFor="np-prefix">Prefix</FieldLabel>
              <Input
                id="np-prefix"
                className="mt-4 font-mono uppercase"
                placeholder="GW"
                value={draft.itemPrefix}
                onChange={(next) => setDraft({ ...draft, itemPrefix: next })}
              />
            </div>
          </div>
          {createProject.isError ? (
            <FieldError className="m-0">{createProject.error.message}</FieldError>
          ) : null}
        </div>
        <DialogFooter cancel={<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>}>
          <Button
            variant="solid"
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
