import { useEffect, useState } from 'react';
import { ApiError } from '../../api/api-error';
import type { SignalsAppRow } from '../../api/signals/signals-api';
import { usePatchApp } from '../../api/signals/use-signals';
import { Button } from '../../ui/button';
import { DialogFooter } from '@tickets/ui/dialog-footer';
import { DialogContent, DialogRoot, DialogTitle } from '../../ui/dialog';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';

type ManagedApp = Pick<SignalsAppRow, 'id' | 'name' | 'slug'>;

/**
 * Rename dialog for an app's `⋯` menu (roster row) and the detail page
 * header — same shell/styling as new-app-dialog.tsx's name form. A 409 from
 * PATCH /apps/:id (the new name's slug already belongs to a different app,
 * per apps.routes.ts) reads as a friendly collision message; anything else
 * falls back to the server's message.
 */
export function RenameAppDialog({
  app,
  open,
  onOpenChange,
}: {
  app: ManagedApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const patchApp = usePatchApp();
  const [name, setName] = useState(app.name);

  // Reset to the app's current name whenever the dialog (re)opens — the same
  // instance can be reused across a different `app` between opens.
  useEffect(() => {
    if (open) {
      setName(app.name);
      patchApp.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id, app.name]);

  function change(next: boolean) {
    onOpenChange(next);
  }

  async function submit() {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === app.name) {
      return;
    }
    try {
      await patchApp.mutateAsync({ id: app.id, name: trimmed });
      change(false);
    } catch {
      // swallow — patchApp.isError/.error already drives the inline error
      // message below, matching new-app-dialog.tsx's convention.
    }
  }

  const errorMessage = !patchApp.isError
    ? null
    : patchApp.error instanceof ApiError && patchApp.error.status === 409
      ? 'an app with that name already exists'
      : patchApp.error instanceof Error
        ? patchApp.error.message
        : 'Could not rename the app';

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent>
        <DialogTitle>Rename app</DialogTitle>
        <div className="mt-4">
          <FieldLabel htmlFor="rename-app-name">Name</FieldLabel>
          <Input
            id="rename-app-name"
            className="mt-1.5"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit();
              }
            }}
          />
        </div>
        {errorMessage !== null ? (
          <p className="mt-2 font-sans text-meta text-danger">{errorMessage}</p>
        ) : null}
        <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
          <Button
            variant="primary"
            disabled={name.trim() === '' || name.trim() === app.name}
            loading={patchApp.isPending}
            onClick={() => void submit()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
