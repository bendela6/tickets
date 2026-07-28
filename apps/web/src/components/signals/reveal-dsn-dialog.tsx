import type { SignalsAppRow } from '../../api/signals/signals-api';
import { useSignalsApp } from '../../api/signals/use-signals';
import { DialogContent, DialogRoot, DialogTitle } from '@tickets/ui';
import { DsnField } from './dsn-field';
import { SdkSnippet } from './sdk-snippet';

type ManagedApp = Pick<SignalsAppRow, 'id' | 'name' | 'slug'>;

/**
 * "Reveal DSN" dialog for the roster row's `⋯` menu. SignalsAppRow (the
 * roster's list shape) never carries the dsn/ingestKey — only GET
 * /apps/:id does — so this fetches the app detail on demand via
 * useSignalsApp rather than sending the user to the detail page just to
 * read a DSN they could copy right from the menu.
 */
export function RevealDsnDialog({
  app,
  open,
  onOpenChange,
}: {
  app: ManagedApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const appQuery = useSignalsApp(app.id);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          <span className="font-mono text-15">{app.slug}</span> DSN
        </DialogTitle>
        {appQuery.data === undefined ? (
          <p className="mt-3 font-mono text-[11.5px] text-gray-9">loading…</p>
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-1.5 font-mono text-11/13 tracking-wider font-500 tracking-wide text-gray-9">DSN</div>
              <DsnField dsn={appQuery.data.dsn} />
            </div>
            <SdkSnippet dsn={appQuery.data.dsn} platform="react" className="mt-4" />
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
