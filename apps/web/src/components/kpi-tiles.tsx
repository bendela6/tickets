import type { Board } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';

export function KpiTiles({ board, indexes }: { board: Board; indexes: BoardIndexes }) {
  const topLevel = board.tickets.filter((ticket) => !ticket.archivedAt && ticket.parentId === null);
  const byKind = { todo: 0, active: 0, blocked: 0, done: 0, dropped: 0 };
  const severityField = indexes.fieldByKey.get('severity');
  const severityOptions = severityField
    ? (indexes.optionsByFieldId.get(severityField.id) ?? [])
    : [];
  const remainingBySeverity = new Map<string, number>();
  for (const ticket of topLevel) {
    const statusKey = indexes.statusField ? ticket.values[indexes.statusField.key] : undefined;
    const kind =
      (typeof statusKey === 'string' ? indexes.statusByKey.get(statusKey)?.kind : undefined) ??
      'todo';
    byKind[kind] += 1;
    if (kind === 'todo' || kind === 'active' || kind === 'blocked') {
      const severity = severityField ? ticket.values[severityField.key] : undefined;
      if (typeof severity === 'string') {
        remainingBySeverity.set(severity, (remainingBySeverity.get(severity) ?? 0) + 1);
      }
    }
  }
  const remainingTotal =
    [...remainingBySeverity.values()].reduce((sum, count) => sum + count, 0) || 1;

  return (
    <section className="tiles">
      <div className="tile">
        <span className="label">To do</span>
        <span className="value">{byKind.todo}</span>
        <span className="context">not started</span>
      </div>
      <div className="tile">
        <span className="label">Active</span>
        <span className="value">{byKind.active + byKind.blocked}</span>
        <span className="context">
          {byKind.blocked > 0 ? `${byKind.blocked} blocked` : 'being worked'}
        </span>
      </div>
      <div className="tile">
        <span className="label">Done</span>
        <span className="value">{byKind.done}</span>
        <span className="context">
          {byKind.dropped > 0 ? `+ ${byKind.dropped} dropped · ` : ''}of {topLevel.length} total
        </span>
      </div>
      <div className="tile bar-tile">
        <span className="label">Remaining by severity</span>
        <div className="sevbar">
          {severityOptions.map((option) => {
            const count = remainingBySeverity.get(option.value) ?? 0;
            if (count === 0) {
              return null;
            }
            return (
              <div
                key={option.id}
                className="seg"
                title={`${count} remaining · ${option.label}`}
                style={{
                  width: `${(count / remainingTotal) * 100}%`,
                  background: option.config.color ?? 'var(--baseline)',
                }}
              />
            );
          })}
        </div>
        <div className="legend">
          {severityOptions.map((option) => (
            <span key={option.id} className="item">
              <span
                className="dot"
                style={{ background: option.config.color ?? 'var(--baseline)' }}
              />
              {option.label} <b>{remainingBySeverity.get(option.value) ?? 0}</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
