import { useEffect, useState } from 'react';
import type { SignalsAppRow } from '../../api/signals/signals-api';
import { useDeleteApp } from '../../api/signals/use-signals';
import { Button, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldLabel, Input } from '@tickets/ui';

type ManagedApp = Pick<SignalsAppRow, 'id' | 'name' | 'slug'>;

/**
 * Delete-app dialog: typed-confirm (type the slug exactly) before the hard
 * delete — apps.routes.ts's DELETE /apps/:id removes the app's signals,
 * issues, and sourcemap artifacts in one transaction, so this is
 * irreversible. `onDeleted` is optional so the roster's row menu (which
 * just lets the row disappear from the invalidated list) and the detail
 * page (which has nowhere left to render once its app is gone, so it must
 * navigate back to the roster) can each wire their own follow-up.
 */
export function DeleteAppDialog({
  app,
  open,
  onOpenChange,
  onDeleted,
}: {
  app: ManagedApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const deleteApp = useDeleteApp();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) {
      setTyped('');
      deleteApp.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id]);

  function change(next: boolean) {
    onOpenChange(next);
  }

  async function confirm() {
    if (typed !== app.slug) {
      return;
    }
    try {
      await deleteApp.mutateAsync(app.id);
      change(false);
      onDeleted?.();
    } catch {
      // swallow — deleteApp.isError/.error drives the inline error below.
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent>
        <DialogTitle>Delete app</DialogTitle>
        <p className="mt-6 font-sans text-12/17 text-gray-11">
          This permanently deletes <strong className="font-500 text-gray-12">{app.slug}</strong> — its
          signals, issues, releases, and source maps. This cannot be undone.
        </p>
        <div className="mt-16">
          <FieldLabel htmlFor="delete-app-confirm">
            Type <span className="font-mono text-gray-12 normal-case">{app.slug}</span> to confirm
          </FieldLabel>
          <Input
            id="delete-app-confirm"
            className="mt-6"
            value={typed}
            autoFocus
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void confirm();
              }
            }}
          />
        </div>
        {deleteApp.isError ? (
          <p className="mt-8 font-sans text-12/17 text-red-9">
            {deleteApp.error instanceof Error ? deleteApp.error.message : 'Could not delete the app'}
          </p>
        ) : null}
        <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
          <Button
            variant="solid" tone="danger"
            disabled={typed !== app.slug}
            loading={deleteApp.isPending}
            onClick={() => void confirm()}
          >
            Delete app
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
