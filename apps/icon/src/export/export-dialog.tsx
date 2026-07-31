import { useState } from 'react';
import {
  Button,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Tabs,
  cn,
} from '@tickets/ui';
import { safeZoneWarnings } from '../doc/validate';
import { useEditor } from '../editor-context';
import { anySustained, cycleSeconds, sustainedState } from '../transport/clock';
import { runExport } from './run';
import { TARGETS, type TargetId } from './targets';

const DEFAULT_ON: TargetId[] = ['fav', 'pwa', 'ios'];

/**
 * The only place in the product that produces files, opened deliberately from
 * the top-bar button and from nowhere else.
 *
 * Two groups. Static targets have to answer *which* state they capture, so the
 * group header carries a state picker. Animated targets stay in place when no
 * state is sustained — unavailable, with the reason where their filename would
 * be — rather than disappearing and leaving the reader to wonder.
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { state, view } = useEditor();
  const { doc } = state;
  const [chosen, setChosen] = useState<TargetId[]>(DEFAULT_ON);
  const [stateId, setStateId] = useState(doc.states[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const canAnimate = anySustained(doc);
  const sustained = sustainedState(doc);
  const warnings = safeZoneWarnings(doc);
  const firstWarning = warnings[0];

  const available = (id: TargetId) =>
    canAnimate || !TARGETS.find((target) => target.id === id)?.animated;
  const active = chosen.filter(available);
  const fileCount = active.reduce(
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
      const archive = await runExport({ doc, ground: view.ground, stateId, targets: active });
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
      <DialogContent className="w-140 max-w-full p-0">
        <div className="flex items-start gap-3 border-b-1 border-gray-6 px-5 pb-3.5 pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.75">
            <DialogTitle className="font-sans text-16 font-600 text-gray-12">
              Export icon
            </DialogTitle>
            <span className="font-sans text-12 text-gray-11">
              Rasterised from the {doc.artboard.width} × {doc.artboard.height} vector source. Nothing is written until
              you press Export.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-5 pb-4 pt-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex-none font-sans text-9 font-500 tracking-widest text-gray-9">
              STATIC TARGETS
            </span>
            <span className="flex-1" />
            <span className="flex-none font-mono text-10 text-gray-9">single state</span>
            <Tabs
              role="group"
              variant="segment"
              size="sm"
              label="State to capture"
              items={doc.states.map((s) => ({
                value: s.id,
                label: s.sustain ? `${s.name} ↻` : s.name,
              }))}
              value={stateId}
              onChange={setStateId}
            />
          </div>

          <ul className="flex flex-col gap-0.5">
            {TARGETS.filter((target) => !target.animated).map((target) => (
              <TargetRow
                key={target.id}
                target={target}
                on={chosen.includes(target.id)}
                available
                onToggle={() => toggle(target.id)}
              />
            ))}
          </ul>

          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="flex-none font-sans text-9 font-500 tracking-widest text-gray-9">
              ANIMATED TARGETS
            </span>
            <span className="flex-1 text-right font-mono text-10 text-gray-9">
              {canAnimate && sustained
                ? `from the ${sustained.name} state · ${cycleSeconds(doc).toFixed(2)}s loop`
                : 'no state is sustained — mark one in the state manager'}
            </span>
          </div>

          <ul className="flex flex-col gap-0.5">
            {TARGETS.filter((target) => target.animated).map((target) => (
              <TargetRow
                key={target.id}
                target={target}
                on={canAnimate && chosen.includes(target.id)}
                available={canAnimate}
                onToggle={() => toggle(target.id)}
              />
            ))}
          </ul>

          {firstWarning ? (
            <div className="mt-0.5 flex items-start gap-2.5 rounded-lg bg-surface-inset px-3.25 py-2.75 inset-ring-1 inset-ring-red-9">
              <span
                aria-hidden
                className="mt-px flex size-4 flex-none items-center justify-center rounded-full border-1 border-red-9 font-sans text-10 font-600 text-red-9"
              >
                !
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.75">
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

          <div className="mt-0.5 flex items-center gap-2.5 rounded-lg bg-surface-inset px-3.25 py-2.75">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-mono text-12 font-500 text-gray-12">
                {fileCount} files · {active.length} targets
              </span>
              <span className="font-mono text-10 text-gray-9">
                static from the {doc.states.find((s) => s.id === stateId)?.name} state
                {active.some((id) => TARGETS.find((t) => t.id === id)?.animated) && sustained
                  ? ` · motion from ${sustained.name}`
                  : ''}{' '}
                · into {doc.name.replace(/\.icon$/, '')}.zip
              </span>
            </div>
            <span className="flex-none font-mono text-10 text-gray-9">PNG · ICO · ICNS</span>
          </div>
        </div>

        <div className="flex items-center gap-2.25 border-t-1 border-gray-6 bg-gray-1 px-5 py-3.25">
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
  available,
  onToggle,
}: {
  target: (typeof TARGETS)[number];
  on: boolean;
  available: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-disabled={!available || undefined}
        onClick={() => available && onToggle()}
        className={cn(
          'flex h-8.5 w-full items-center gap-2.5 rounded-md px-2.25 text-left',
          on && 'bg-surface-inset',
          available ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'relative size-4 flex-none rounded-sm border-1',
            on
              ? 'border-indigo-9 bg-indigo-9'
              : available
                ? 'border-gray-7 bg-surface-raised'
                : 'border-dashed border-gray-7 bg-transparent opacity-70',
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
          className={cn(
            'flex-none font-sans text-12',
            on ? 'font-500 text-gray-12' : available ? 'text-gray-11' : 'text-gray-9',
          )}
        >
          {target.name}
        </span>
        <span className="flex-1" />
        <span className={cn('flex-none font-mono text-11 text-gray-9', !available && 'opacity-70')}>
          {target.sizes}
        </span>
        <span
          className={cn(
            'w-28 flex-none text-right font-mono text-11',
            available ? 'text-gray-11' : 'text-gray-9',
          )}
        >
          {available ? target.writes : 'needs a sustained state'}
        </span>
      </button>
    </li>
  );
}
