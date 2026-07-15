import type * as v from 'valibot';
import type { DbExecutor } from '@tickets/db';
import type { EventDef } from '../event/registry';
import type { CommandEnvelope } from './envelope';

export interface CommandContext {
  envelope: CommandEnvelope;
  aggregateId: number; // handler sets this for create commands, before emitting
  projectId: number | null; // handler sets this for item events
  emit<S extends v.GenericSchema>(def: EventDef<S>, payload: v.InferOutput<S>): Promise<void>;
}

export interface CommandDef<S extends v.GenericSchema = v.GenericSchema, TResult = unknown> {
  kind: string;
  input: S;
  aggregate: (input: v.InferOutput<S>) => { type: string; id?: number };
  handler: (tx: DbExecutor, input: v.InferOutput<S>, ctx: CommandContext) => Promise<TResult>;
}

const registry = new Map<string, CommandDef>();

export function defineCommand<S extends v.GenericSchema, TResult>(
  def: CommandDef<S, TResult>,
): CommandDef<S, TResult> {
  if (registry.has(def.kind)) {
    throw new Error(`command kind "${def.kind}" is already registered`);
  }
  registry.set(def.kind, def as unknown as CommandDef);
  return def;
}

export function commandKind(kind: string): CommandDef | undefined {
  return registry.get(kind);
}
