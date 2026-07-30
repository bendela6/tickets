import { cn, runtimeStyle } from '@tickets/ui';
import { mix } from '../../ui/color-mix';

interface ErrorBannerProps {
  errors: string[];
  warnings: string[];
  onDismiss: () => void;
}

export function ErrorBanner({ errors, warnings, onDismiss }: ErrorBannerProps) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div
      className={cn(
        'absolute left-1/2 top-3 z-50 max-w-(--banner-max-w) -translate-x-1/2 px-4 py-3',
        'rounded-lg border border-(--banner-border) bg-(--banner-bg) shadow-modal',
      )}
      style={runtimeStyle({
        '--banner-border': mix('var(--color-red-9)', 55, 'var(--color-gray-6)'),
        '--banner-bg': mix('var(--color-red-9)', 14, 'var(--color-gray-2)'),
      })}
    >
      <button
        type="button"
        className="absolute right-3 top-2 text-16 text-gray-11 hover:text-gray-12"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
      {errors.length > 0 ? (
        <h3 className="mb-2 text-13 text-red-9">{errors.length} error(s) — the model cannot render</h3>
      ) : (
        <h3 className="mb-2 text-13 text-yellow-9">{warnings.length} warning(s)</h3>
      )}
      <ul className="ml-5 list-disc text-12 leading-relaxed text-gray-12">
        {errors.map((e, i) => (
          <li key={`e${i}`}>{e}</li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w${i}`} className="text-yellow-9">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
