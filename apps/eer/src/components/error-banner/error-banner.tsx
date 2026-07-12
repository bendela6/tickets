import { cn } from '../../ui/cn';

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
        'absolute left-1/2 top-3 z-50 max-w-banner -translate-x-1/2 px-4 py-3',
        'rounded-lg border border-danger-border bg-danger-surface shadow-overlay',
      )}
    >
      <button
        type="button"
        className="absolute right-2.5 top-2 text-lg text-muted hover:text-ink"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
      {errors.length > 0 ? (
        <h3 className="mb-1.5 text-base text-danger">{errors.length} error(s) — the model cannot render</h3>
      ) : (
        <h3 className="mb-1.5 text-base text-pk">{warnings.length} warning(s)</h3>
      )}
      <ul className="ml-4.5 list-disc text-sm leading-relaxed text-ink">
        {errors.map((e, i) => (
          <li key={`e${i}`}>{e}</li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w${i}`} className="text-pk">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
