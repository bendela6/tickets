import { useState } from 'react';
import type { SignalsAppDetail } from '../../api/signals/signals-api';
import { useCreateSignalsApp } from '../../api/signals/use-signals';
import { Button, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldLabel, Input, Tabs } from '@tickets/ui';
import { DsnField } from './dsn-field';

type SnippetTab = 'react' | 'node' | 'script';

const TABS: { id: SnippetTab; label: string }[] = [
  { id: 'react', label: 'React' },
  { id: 'node', label: 'Node' },
  { id: 'script', label: '<script>' },
];

// Static per-tab install+init snippets (docs/signals-sdk.md's quickstarts,
// trimmed to what fits a dialog) with the real @bendela6/* package names and
// the freshly issued dsn interpolated. No live "waiting for a signal" state
// — v1 has no polling, so the copy below just points at Issues instead.
function reactSnippet(dsn: string): string {
  return `# npm install @bendela6/signals-react

import { initSignals } from '@bendela6/signals-react';

initSignals({
  dsn: '${dsn}',
  release: import.meta.env.VITE_APP_VERSION,
  environment: 'development',
});`;
}

function nodeSnippet(dsn: string): string {
  return `# npm install @bendela6/signals-node

import { initSignals } from '@bendela6/signals-node';

const signals = initSignals({
  dsn: '${dsn}',
  release: process.env.RELEASE,
  environment: process.env.NODE_ENV,
});`;
}

// The collector always serves /sdk.js on its own fixed port (4640, see
// docs/signals-sdk.md) regardless of what port the web app itself is on —
// only the hostname is worth reading from the browser's own location.
function scriptSnippet(dsn: string): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  return `<script src="http://${host}:4640/sdk.js" data-dsn="${dsn}"></script>`;
}

function snippetFor(tab: SnippetTab, dsn: string): string {
  if (tab === 'react') return reactSnippet(dsn);
  if (tab === 'node') return nodeSnippet(dsn);
  return scriptSnippet(dsn);
}

// The Apps screen's "＋ New app" flow (docs/design/SigApps.dc.html "new"
// variant): a name form that, on a successful POST, swaps in place to a
// success panel — DSN + snippet tabs — rather than closing. Reopening after
// a close always starts back at the name form (`reset()` on close).
export function NewAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createApp = useCreateSignalsApp();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<SignalsAppDetail | null>(null);
  const [tab, setTab] = useState<SnippetTab>('react');

  function reset() {
    setName('');
    setCreated(null);
    setTab('react');
    createApp.reset();
  }

  function change(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  async function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    try {
      const result = await createApp.mutateAsync(trimmed);
      setCreated(result);
    } catch {
      // swallow — createApp.isError/.error already drives the inline
      // error message below, matching new-item-dialog.tsx's convention.
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent className="w-[min(640px,calc(100vw-2rem))]">
        {created === null ? (
          <>
            <DialogTitle>New app</DialogTitle>
            <div className="mt-4">
              <FieldLabel htmlFor="new-app-name">Name</FieldLabel>
              <Input
                id="new-app-name"
                className="mt-1.5"
                placeholder="storefront-web"
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
            {createApp.isError ? (
              <p className="mt-2 font-sans text-meta text-red-9">
                {createApp.error instanceof Error ? createApp.error.message : 'Could not create the app'}
              </p>
            ) : null}
            <DialogFooter cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}>
              <Button
                variant="solid"
                disabled={name.trim() === ''}
                loading={createApp.isPending}
                onClick={() => void submit()}
              >
                Create app
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-green-3 font-sans text-13 font-600 text-green-9">
                ✓
              </span>
              <div className="flex-1">
                <DialogTitle>
                  <span className="font-mono text-15">{created.slug}</span> is ready
                </DialogTitle>
                <p className="mt-1 font-sans text-[12.5px] leading-relaxed text-gray-11">
                  Wire the SDK to this DSN. Signals send to your local daemon — nothing leaves the
                  machine.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 font-mono text-label font-500 tracking-wide text-gray-9">DSN</div>
              <DsnField dsn={created.dsn} />
            </div>

            <div className="mt-4">
              <Tabs
                items={TABS.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
                value={tab}
                onChange={(next) => setTab(next as SnippetTab)}
              />
              <pre className="overflow-x-auto rounded-b-[8px] border border-t-0 border-gray-6 bg-surface-inset px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-gray-11">
                {snippetFor(tab, created.dsn)}
              </pre>
            </div>

            <div className="mt-4 flex items-center gap-2.5 border-t border-gray-6 pt-3.5">
              <span className="font-mono text-[11.5px] text-gray-9">
                Send your first signal and it will appear under Issues.
              </span>
              <DialogFooter
                className="mt-0 flex-1 border-0 p-0"
                cancel={<Button variant="ghost" onClick={() => change(false)}>Close</Button>}
              />
            </div>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
