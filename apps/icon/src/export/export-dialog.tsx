import { useState } from 'react';
import { Button, DialogContent, DialogRoot, DialogTitle, cn } from '@tickets/ui';
import { safeZoneWarnings } from '../doc/validate';
import { useEditor } from '../editor-context';
import { runExport } from './run';
import { TARGETS, type TargetId } from './targets';

const DEFAULT_ON: TargetId[] = ['fav', 'pwa', 'ios'];

/**
 * The only place in the product that produces files, opened deliberately from
 * the top-bar button and from nowhere else.
 *
 * One list, because every target is the same kind of thing: the one picture the
 * document holds, rasterised for a platform.
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { state, view } = useEditor();
  const { doc } = state;
  const [chosen, setChosen] = useState<TargetId[]>(DEFAULT_ON);
  const [busy, setBusy] = useState(false);

  const warnings = safeZoneWarnings(doc);
  const firstWarning = warnings[0];

  const fileCount = chosen.reduce(
    (total, id) => total + (TARGETS.find((target) => target.id === id)?.files ?? 0),
    0,
  );

  const toggle = (id: TargetId) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const download = async () => {
    setBusy(true);
    try {
      const archive = await runExport({ doc, ground: view.ground, targets: chosen });
      // `archive.buffer` is typed `ArrayBufferLike`, which Blob will not take
      // because it could in principle be shared memory. It never is here, so
      // the bytes are copied into a plain buffer rather than cast.
      const bytes = new Uint8Array(archive);
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${doc.name.replace(/\.icon$/, '')}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-560 max-w-full p-0">
        <div className="flex items-start gap-12 border-b-1 border-gray-6 px-20 pb-14 pt-16">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DialogTitle className="font-sans text-16 font-600 text-gray-12">
              Export icon
            </DialogTitle>
            <span className="font-sans text-12 text-gray-11">
              Rasterised from the {doc.artboard.width} × {doc.artboard.height} vector source. Nothing is written until
              you press Export.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-10 px-20 pb-16 pt-14">
          <span className="font-sans text-9 font-500 tracking-widest text-gray-9">
            TARGETS
          </span>

          <ul className="flex flex-col gap-2">
            {TARGETS.map((target) => (
              <TargetRow
                key={target.id}
                target={target}
                on={chosen.includes(target.id)}
                onToggle={() => toggle(target.id)}
              />
            ))}
          </ul>

          {firstWarning ? (
            <div className="mt-2 flex items-start gap-10 rounded-8 bg-surface-inset px-13 py-11 inset-ring-1 inset-ring-red-9">
              <span
                aria-hidden
                className="mt-px flex size-16 flex-none items-center justify-center rounded-full border-1 border-red-9 font-sans text-10 font-600 text-red-9"
              >
                !
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="font-sans text-12 font-500 text-red-9">
                  {firstWarning.name} reaches {firstWarning.percent}% of the tile
                </span>
                <span className="font-sans text-11/relaxed text-gray-11 text-pretty">
                  Android crops a maskable icon to a circle and cuts everything past 80%. Affects
                  the Android and PWA maskable output; the other targets are unaffected.
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-10 rounded-8 bg-surface-inset px-13 py-11">
            <div className="flex flex-1 flex-col gap-2">
              <span className="font-mono text-12 font-500 text-gray-12">
                {fileCount} files · {chosen.length} targets
              </span>
              <span className="font-mono text-10 text-gray-9">
                into {doc.name.replace(/\.icon$/, '')}.zip
              </span>
            </div>
            <span className="flex-none font-mono text-10 text-gray-9">PNG · ICO · ICNS</span>
          </div>
        </div>

        <div className="flex items-center gap-9 border-t-1 border-gray-6 bg-gray-1 px-20 py-13">
          <span className="flex-1 font-mono text-11 text-gray-9">
            {fileCount ? 'nothing is written until you press Export' : 'pick at least one target'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            disabled={fileCount === 0}
            loading={busy}
            onClick={() => void download()}
          >
            {fileCount ? `Export ${fileCount} files` : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

function TargetRow({
  target,
  on,
  onToggle,
}: {
  target: (typeof TARGETS)[number];
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          'flex h-34 w-full cursor-pointer items-center gap-10 rounded-6 px-9 text-left',
          on && 'bg-surface-inset',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'relative size-16 flex-none rounded-4 border-1',
            on ? 'border-indigo-9 bg-indigo-9' : 'border-gray-7 bg-surface-raised',
          )}
        >
          {on ? (
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="absolute inset-0 text-indigo-contrast"
              fill="none"
            >
              <path
                d="M4 8.5 L6.75 11 L12 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>

        <span
          className={cn('flex-none font-sans text-12', on ? 'font-500 text-gray-12' : 'text-gray-11')}
        >
          {target.name}
        </span>
        <span className="flex-1" />
        <span className="flex-none font-mono text-11 text-gray-9">{target.sizes}</span>
        <span className="w-112 flex-none text-right font-mono text-11 text-gray-11">
          {target.writes}
        </span>
      </button>
    </li>
  );
}
