import * as v from 'valibot';
import { HttpError } from '../errors';

export interface CommandEnvelope {
  commandId: string;
  actorId: number;
  correlationId?: string;
}

// Non-strict: the same body also carries the command's own payload fields.
const envelopeSchema = v.object({
  commandId: v.pipe(v.string(), v.uuid()),
  actorId: v.pipe(v.number(), v.integer()),
  correlationId: v.optional(v.pipe(v.string(), v.uuid())),
});

export function parseEnvelope(body: unknown): CommandEnvelope {
  const result = v.safeParse(envelopeSchema, body);
  if (!result.success) {
    throw new HttpError(400, 'invalid command envelope: commandId (uuid) and actorId are required');
  }
  return result.output;
}
