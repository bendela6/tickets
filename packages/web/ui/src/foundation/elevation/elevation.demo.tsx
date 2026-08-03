import { SHADOWS } from '../spec';
import { DriftView, Sheet, SpecHeader, SpecRow, useTheme } from '../view';

export const meta = {
  title: 'Elevation',
  group: 'Foundation',
  order: 4,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

// Elevation answers "how far above the page is this, and can I dismiss it?".
// Three levels because there are three answers: attached, floating over one
// surface, and floating over everything.
const SHADOW_JOBS: Record<string, string> = {
  'shadow-xs': 'cards, rows — attached to the page',
  'shadow-md': 'popovers, menus — dismissible',
  'shadow-lg': 'dialogs, sheets — blocking',
};

/** The one family whose token resolves differently per theme. */
function useShadow() {
  const [theme, ref] = useTheme();
  return {
    ref,
    theme,
    valueOf: (name: string) => {
      const token = SHADOWS.find((s) => s.name === name);
      // Naming the miss, rather than asserting it away: a renamed token used
      // to reach the DOM as `undefined` and take the page down with a message
      // about reading `light`, which says nothing about which token is gone.
      if (!token) {
        throw new Error(
          `elevation demo asks for "${name}", which is not a shadow token (have: ${SHADOWS.map((s) => s.name).join(', ')})`,
        );
      }
      return theme === 'dark' ? token.dark : token.light;
    },
  };
}

function Levels() {
  const { ref, theme, valueOf } = useShadow();
  return (
    <div ref={ref} className="flex w-full flex-col gap-3">
      <SpecHeader value="used for" specimen={`specimen · ${theme}`} />
      {SHADOWS.map((shadow) => (
        <SpecRow
          key={shadow.name}
          name={shadow.name}
          value={SHADOW_JOBS[shadow.name] ?? ''}
          note={theme === 'dark' ? 'dark values' : 'light values'}
          align="start"
        >
          <div className="flex items-center gap-4 bg-gray-1 p-5">
            <span
              className="flex h-16 w-40 items-center justify-center rounded-lg bg-surface-raised font-mono text-12/17 text-gray-9"
              style={{ boxShadow: valueOf(shadow.name) }}
            >
              {shadow.name.replace('shadow-', '')}
            </span>
            <code className="min-w-0 flex-1 font-mono text-9/12 leading-tight text-gray-9">
              {valueOf(shadow.name)}
            </code>
          </div>
        </SpecRow>
      ))}
    </div>
  );
}

function InUse() {
  const { ref, valueOf } = useShadow();
  return (
    <div ref={ref} className="flex w-full flex-col gap-3">
      {/* All three stacked in one scene, because elevation is comparative —
          a modal only reads as blocking next to something it blocks. */}
      <div className="relative flex min-h-64 items-start gap-4 overflow-hidden rounded-xl bg-gray-1 p-5">
        <div
          className="flex w-56 flex-col gap-1 rounded-lg bg-surface-raised p-3"
          style={{ boxShadow: valueOf('shadow-xs') }}
        >
          <span className="font-sans text-13/19 font-500 text-gray-12">Retry the gateway run</span>
          <span className="font-mono text-12/17 text-gray-9">TIX-214</span>
        </div>
        <div
          className="flex w-44 flex-col rounded-lg bg-surface-raised py-1"
          style={{ boxShadow: valueOf('shadow-md') }}
        >
          {['Assign to me', 'Move to review', 'Archive'].map((label) => (
            <span key={label} className="px-3 py-1.5 font-sans text-13/19 text-gray-12">
              {label}
            </span>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div
            className="flex w-64 flex-col gap-2 rounded-xl bg-surface-raised p-4"
            style={{ boxShadow: valueOf('shadow-lg') }}
          >
            <span className="font-sans text-16/22 font-500 text-gray-12">Discard changes?</span>
            <span className="font-sans text-13/19 text-gray-11">
              Three edits will be lost. This cannot be undone.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const states = [
  { name: 'Levels', render: () => <Levels /> },
  { name: 'In use', render: () => <InUse /> },
  { name: 'Drift', render: () => <DriftView families={['shadow']} /> },
];
