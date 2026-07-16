import { v5 as uuidv5 } from 'uuid';
import type * as v from 'valibot';
import type { Db } from '@tickets/db';
import { runCommand } from '../command/run-command';
import type { CommandDef } from '../command/registry';
import { AUTOMATION_NS } from './constants';
import type { StoredEvent } from './registry';

export interface AutomationContext {
  dispatch<S extends v.GenericSchema, R>(
    command: CommandDef<S, R>,
    input: v.InferOutput<S>,
    key?: string,
  ): Promise<R>;
}

// Every dispatch derives its commandId from (sourceEvent, automationId, key) so a
// re-drained event dedupes against the commands ledger. `key` distinguishes
// multiple dispatches from one rule (e.g. one per link target).
export function makeAutomationContext(
  db: Db,
  event: StoredEvent,
  automationId: string,
  systemActorId: number,
): AutomationContext {
  return {
    dispatch(command, input, key = '') {
      const commandId = uuidv5(`${event.id}:${automationId}:${key}`, AUTOMATION_NS);
      return runCommand(db, command, {
        commandId,
        actorId: systemActorId,
        correlationId: event.correlationId,
        causedBy: event.id,
        depth: event.depth + 1,
      }, input);
    },
  };
}
