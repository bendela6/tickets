export function ValueBadge({
  label,
  color,
  mark,
}: {
  label: string;
  color?: string;
  mark?: 'done' | 'dropped';
}) {
  if (mark === 'done') {
    return (
      <span className="badge">
        <span className="mark" style={{ color: 'var(--good)' }}>
          ✓
        </span>
        {label}
      </span>
    );
  }
  if (mark === 'dropped') {
    return (
      <span className="badge">
        <span className="mark" style={{ color: 'var(--muted)' }}>
          ✕
        </span>
        {label}
      </span>
    );
  }
  return (
    <span className="badge">
      <span className="dot" style={{ background: color ?? 'var(--baseline)' }} />
      {label}
    </span>
  );
}
