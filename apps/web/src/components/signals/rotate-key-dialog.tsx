import { useEffect, useState } from 'react';
import type { SignalsAppDetail, SignalsAppRow } from '../../api/signals/signals-api';
import { useRotateAppKey } from '../../api/signals/use-signals';
import { Button, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldLabel, Input } from '@tickets/ui';
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
            <p className="mt-6 font-sans text-12/17 text-gray-11">
              This issues a new ingest key for{' '}
              <strong className="font-500 text-gray-12">{app.slug}</strong>. The old DSN stops accepting
              signals immediately — every SDK using it must be updated.
            </p>
            <div className="mt-16">
              <FieldLabel htmlFor="rotate-key-confirm">
                Type <span className="font-mono text-gray-12 normal-case">{app.slug}</span> to confirm
              </FieldLabel>
              <Input
                id="rotate-key-confirm"
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
            {rotateKey.isError ? (
              <p className="mt-8 font-sans text-12/17 text-red-9">
                {rotateKey.error instanceof Error ? rotateKey.error.message : 'Could not rotate the key'}
              </p>
            ) : null}
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
              <Button
                variant="solid" tone="danger"
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
            <p className="mt-6 font-sans text-12/17 text-red-9">
              The old DSN no longer works. Update every SDK pointed at {app.slug} with the new DSN below.
            </p>
            <div className="mt-16">
              <div className="mb-6 font-mono text-11/13 tracking-wider font-500 tracking-wide text-gray-9">NEW DSN</div>
              <DsnField dsn={rotated.dsn} />
            </div>
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Close</Button>} />
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
