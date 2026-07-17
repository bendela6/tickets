import type { DbExecutor } from '@tickets/db';
import { events } from '@tickets/db';

export type StoredEvent = typeof events.$inferSelect;

// Set in Task 6; imported as a type only to keep this file dependency-light.
import type { AutomationContext } from './context';

export interface AutomationDef {
  id: string;
  on: string[];
  when: (event: StoredEvent, tx: DbExecutor) => Promise<boolean>;
  run: (event: StoredEvent, ctx: AutomationContext) => Promise<void>;
}

const registry = new Map<string, AutomationDef>();

export function defineAutomation(def: AutomationDef): AutomationDef {
  if (registry.has(def.id)) {
    throw new Error(`automation id "${def.id}" is already registered`);
  }
  registry.set(def.id, def);
  return def;
}

export function automationsFor(eventKind: string): AutomationDef[] {
  return [...registry.values()].filter((a) => a.on.includes(eventKind));
}

export function allAutomations(): AutomationDef[] {
  return [...registry.values()];
}
