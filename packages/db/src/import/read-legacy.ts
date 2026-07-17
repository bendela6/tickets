// packages/db/src/import/read-legacy.ts
// Faithful raw-SQL reader for the pre-rebuild ticket* schema, restored into
// tickets_legacy (see legacy-client.ts). No transformation beyond snake_case
// -> camelCase column names — Task 9 does the mapping into the new schema.
import type { Sql } from 'postgres';

export type LegacyUser = { id: number; name: string; kind: 'human' | 'agent' };
export type LegacyProject = { id: number; key: string; name: string; ticketPrefix: string; schemeId: number; createdAt: string };
export type LegacyTicketType = { id: number; schemeId: number; key: string; label: string; position: number; config: unknown; archivedAt: string | null; createdAt: string };
export type LegacyField = { id: number; ticketTypeId: number; position: number; required: boolean; key: string; label: string; type: string; system: boolean; config: Record<string, unknown>; archivedAt: string | null };
export type LegacyFieldOption = { id: number; fieldId: number; value: string; label: string; position: number; config: Record<string, unknown>; archivedAt: string | null };
export type LegacyStatus = { id: number; ticketTypeId: number; key: string; label: string; kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped'; config: Record<string, unknown>; position: number; archivedAt: string | null };
export type LegacyStatusTransition = { id: number; fromStatusId: number | null; toStatusId: number; ticketTypeId: number | null };
export type LegacyLinkType = { id: number; ticketTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; position: number; archivedAt: string | null };
export type LegacyTicket = { id: number; projectId: number; typeId: number; parentId: number | null; number: number; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string };
export type LegacyTicketValue = { id: number; ticketId: number; fieldId: number; valueText: string | null; valueNumber: string | null; valueDate: string | null; valueBool: boolean | null; valueJson: unknown; optionId: number | null; statusId: number | null };
export type LegacyComment = { id: number; ticketId: number; authorId: number; parentId: number | null; body: string; createdAt: string };
export type LegacyReaction = { id: number; commentId: number; userId: number; emoji: string; createdAt: string };
export type LegacyLink = { id: number; linkTypeId: number; sourceTicketId: number; targetTicketId: number; createdAt: string };
export type LegacyEvent = { id: number; ticketId: number; actorId: number; kind: string; payload: Record<string, unknown>; createdAt: string };
export type LegacyView = { id: number; projectId: number; name: string; config: Record<string, unknown>; position: number; archivedAt: string | null; createdAt: string };

export type Legacy = {
  users: LegacyUser[]; projects: LegacyProject[]; ticketTypes: LegacyTicketType[];
  ticketTypeChildTypes: { parentTypeId: number; childTypeId: number }[];
  fields: LegacyField[]; fieldOptions: LegacyFieldOption[];
  statuses: LegacyStatus[]; statusTransitions: LegacyStatusTransition[];
  linkTypes: LegacyLinkType[]; linkTypeTargetTypes: { linkTypeId: number; targetTypeId: number }[];
  tickets: LegacyTicket[]; ticketValues: LegacyTicketValue[];
  comments: LegacyComment[]; commentReactions: LegacyReaction[];
  ticketLinks: LegacyLink[]; ticketEvents: LegacyEvent[]; views: LegacyView[];
};

const camel = <T>(rows: Record<string, unknown>[]): T[] =>
  rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    }
    return out as T;
  });

export async function readLegacy(sql: Sql): Promise<Legacy> {
  const q = async <T>(table: string, order = 'id'): Promise<T[]> =>
    camel<T>(await sql.unsafe(`SELECT * FROM ${table} ORDER BY ${order}`));

  return {
    users: await q<LegacyUser>('users'),
    projects: await q<LegacyProject>('projects'),
    ticketTypes: await q<LegacyTicketType>('ticket_types'),
    ticketTypeChildTypes: await q('ticket_type_child_types', 'parent_type_id, child_type_id'),
    fields: await q<LegacyField>('fields'),
    fieldOptions: await q<LegacyFieldOption>('field_options'),
    statuses: await q<LegacyStatus>('statuses'),
    statusTransitions: await q<LegacyStatusTransition>('status_transitions'),
    linkTypes: await q<LegacyLinkType>('link_types'),
    linkTypeTargetTypes: await q('link_type_target_types', 'link_type_id, target_type_id'),
    tickets: await q<LegacyTicket>('tickets'),
    ticketValues: await q<LegacyTicketValue>('ticket_values'),
    comments: await q<LegacyComment>('comments'),
    commentReactions: await q<LegacyReaction>('comment_reactions'),
    ticketLinks: await q<LegacyLink>('ticket_links'),
    ticketEvents: await q<LegacyEvent>('ticket_events', 'ticket_id, created_at, id'),
    views: await q<LegacyView>('views'),
  };
}
