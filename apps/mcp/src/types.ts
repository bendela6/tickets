// Lean mirrors of the API payloads — only what the tools consume.
export type Project = { id: number; key: string; name: string; ticketPrefix: string };
export type User = { id: number; name: string; kind: 'human' | 'agent'; archivedAt: string | null };
export type TicketType = {
  id: number;
  key: string;
  label: string;
  position: number;
  archivedAt: string | null;
};
export type Status = {
  id: number;
  key: string;
  label: string;
  kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
  position: number;
  archivedAt: string | null;
};
export type Field = {
  id: number;
  key: string;
  label: string;
  type: string;
  archivedAt: string | null;
  options: { id: number; value: string; label: string; archivedAt: string | null }[];
};
export type LinkType = {
  id: number;
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
};
export type TicketLink = {
  id: number;
  linkTypeId: number;
  sourceTicketId: number;
  targetTicketId: number;
};
export type TicketComment = { id: number; authorId: number; body: string; createdAt: string };
export type BoardTicket = {
  id: number;
  number: number;
  typeId: number;
  parentId: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  values: Record<string, unknown>;
  comments: TicketComment[];
  links: TicketLink[];
};
export type Board = {
  project: Project;
  users: User[];
  types: TicketType[];
  typeFields: { ticketTypeId: number; fieldId: number; position: number; required: boolean }[];
  statuses: Status[];
  transitions: { fromStatusId: number | null; toStatusId: number; ticketTypeId: number | null }[];
  fields: Field[];
  linkTypes: LinkType[];
  views: { id: number; name: string; archivedAt: string | null }[];
  tickets: BoardTicket[];
};
export type TicketEvent = {
  id: number;
  actorId: number;
  actorName: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
