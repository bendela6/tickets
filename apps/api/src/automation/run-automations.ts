import type { Db } from '@tickets/db';
import { makeAutomationContext } from './context';
import type { AutomationDef, StoredEvent } from './registry';
import { automationsFor } from './registry';

export async function runAutomations(
  db: Db,
  event: StoredEvent,
  opts: { systemActorId: number; rules?: AutomationDef[] },
): Promise<void> {
  const candidates = opts.rules ?? automationsFor(event.kind);
  for (const rule of candidates) {
    if (!rule.on.includes(event.kind)) continue;
    if (!(await rule.when(event, db))) continue;
    const ctx = makeAutomationContext(db, event, rule.id, opts.systemActorId);
    await rule.run(event, ctx);
  }
}
