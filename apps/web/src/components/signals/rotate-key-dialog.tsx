import { useEffect, useState } from 'react';
import type { SignalsAppDetail, SignalsAppRow } from '../../api/signals/signals-api';
import { useRotateAppKey } from '../../api/signals/use-signals';
import { Button } from '../../ui/button';
import { DialogFooter } from '@tickets/ui/dialog-footer';
import { DialogContent, DialogRoot, DialogTitle } from '../../ui/dialog';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import { DsnField } from './dsn-field';

type ManagedApp = Pick<SignalsAppRow, 'id' | 'name' | 'slug'>;

/**
 * Rotate-key dialog: typed-confirm (type the app's slug exactly) before
 * issuing a fresh ingest key — the old DSN stops accepting signals the
 * instant this succeeds (apps.routes.ts's POST /apps/:id/rotate just swaps
 * ingest_key, no grace period), so the confirm copy and the post-rotate
 * panel both say so plainly. On success, swaps in place to show the new DSN
 * with a copy affordance rather than closing — same in-place-success shape
 * as new-app-dialog.tsx.
 */
export function RotateKeyDialog({
  app,
  open,
  onOpenChange,
}: {
  app: ManagedApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rotateKey = useRotateAppKey();
  const [typed, setTyped] = useState('');
  const [rotated, setRotated] = useState<SignalsAppDetail | null>(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setRotated(null);
      rotateKey.reset();
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
      const result = await rotateKey.mutateAsync(app.id);
      setRotated(result);
    } catch {
      // swallow — rotateKey.isError/.error drives the inline error below.
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent>
        {rotated === null ? (
          <>
            <DialogTitle>Rotate key</DialogTitle>
            <p className="mt-1.5 font-sans text-meta text-ink-2">
              This issues a new ingest key for{' '}
              <strong className="font-medium text-ink">{app.slug}</strong>. The old DSN stops accepting
              signals immediately — every SDK using it must be updated.
            </p>
            <div className="mt-4">
              <FieldLabel htmlFor="rotate-key-confirm">
                Type <span className="font-mono text-ink normal-case">{app.slug}</span> to confirm
              </FieldLabel>
              <Input
                id="rotate-key-confirm"
                className="mt-1.5"
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
            {rotateKey.isError ? (
              <p className="mt-2 font-sans text-meta text-danger">
                {rotateKey.error instanceof Error ? rotateKey.error.message : 'Could not rotate the key'}
              </p>
            ) : null}
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
              <Button
                variant="destructive"
                disabled={typed !== app.slug}
                loading={rotateKey.isPending}
                onClick={() => void confirm()}
              >
                Rotate key
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle>Key rotated</DialogTitle>
            <p className="mt-1.5 font-sans text-meta text-danger">
              The old DSN no longer works. Update every SDK pointed at {app.slug} with the new DSN below.
            </p>
            <div className="mt-4">
              <div className="mb-1.5 font-mono text-label font-medium tracking-wide text-ink-3">NEW DSN</div>
              <DsnField dsn={rotated.dsn} />
            </div>
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Close</Button>} />
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
