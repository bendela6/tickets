export function ProgressCell({
  any,
  done,
  total,
  blocked,
}: {
  any: boolean;
  done: number;
  total: number;
  blocked: number;
}) {
  if (!any || total === 0) {
    return <span className="no-progress">—</span>;
  }
  const percent = Math.round((done / total) * 100);
  const color = percent === 100 ? 'var(--good)' : 'var(--accent)';
  return (
    <span className="progress-wrap" title={`${done} of ${total} subtasks done`}>
      <span className="progress-track">
        <span className="progress-fill" style={{ width: `${percent}%`, background: color }} />
      </span>
      <span className="progress-num">
        {done}/{total}
      </span>
      {blocked > 0 ? <span className="blocked-mark">⛔ {blocked}</span> : null}
    </span>
  );
}
