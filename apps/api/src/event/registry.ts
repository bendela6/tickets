import type * as v from 'valibot';

export interface EventDef<S extends v.GenericSchema = v.GenericSchema> {
  kind: string;
  aggregateType: string;
  version: number;
  payload: S;
}

const registry = new Map<string, EventDef>();

export function defineEvent<S extends v.GenericSchema>(def: EventDef<S>): EventDef<S> {
  if (registry.has(def.kind)) {
    throw new Error(`event kind "${def.kind}" is already registered`);
  }
  registry.set(def.kind, def as unknown as EventDef);
  return def;
}

export function eventKind(kind: string): EventDef | undefined {
  return registry.get(kind);
}
