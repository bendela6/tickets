import { v5 as uuidv5 } from 'uuid';
import type * as v from 'valibot';
import type { Db } from '@tickets/db';
import { runCommand } from '../command/run-command';
import type { CommandDef } from '../command/registry';
import { AUTOMATION_NS } from './constants';
import type { StoredEvent } from './registry';

export interface AutomationContext {
  db: Db;
  dispatch<S extends v.GenericSchema, R>(
    command: CommandDef<S, R>,
    input: v.InferOutput<S>,
    key?: string,
  ): Promise<R>;
}

// Every dispatch derives its commandId from (sourceEvent, automationId, key) so a
// re-drained event dedupes against the commands ledger. `key` distinguishes
// multiple dispatches from one rule (e.g. one per link target). The id also
// tells a rule's own writes apart afterwards: an event whose commandId is
// automationCommandId(its causedBy, rule, key) was written by that rule.
export function automationCommandId(sourceEventId: number, automationId: string, key = ''): string {
  return uuidv5(`${sourceEventId}:${automationId}:${key}`, AUTOMATION_NS);
}

export function makeAutomationContext(
  db: Db,
  event: StoredEvent,
  automationId: string,
  systemActorId: number,
): AutomationContext {
  return {
    db,
    dispatch(command, input, key = '') {
      const commandId = automationCommandId(event.id, automationId, key);
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
