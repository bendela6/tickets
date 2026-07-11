interface ErrorBannerProps {
  errors: string[];
  warnings: string[];
  onDismiss: () => void;
}

export function ErrorBanner({ errors, warnings, onDismiss }: ErrorBannerProps) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="absolute left-1/2 top-3 z-50 max-w-[min(680px,90vw)] -translate-x-1/2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_55%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-4 py-[0.8rem] shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
      <button
        type="button"
        className="absolute right-[0.6rem] top-2 text-base text-muted hover:text-ink"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
      {errors.length > 0 ? (
        <h3 className="mb-[0.4rem] text-[0.85rem] text-danger">{errors.length} error(s) — the model cannot render</h3>
      ) : (
        <h3 className="mb-[0.4rem] text-[0.85rem] text-pk">{warnings.length} warning(s)</h3>
      )}
      <ul className="ml-[1.1rem] list-disc text-[0.76rem] leading-relaxed text-ink">
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
