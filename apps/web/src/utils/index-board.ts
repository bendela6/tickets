import type {
  Board,
  BoardTicket,
  Field,
  FieldOption,
  Status,
  TicketType,
  User,
} from '../api/types';

// One memoizable pass over the board payload; every screen consumes these
// maps instead of re-searching arrays.
export function indexBoard(board: Board) {
  const fieldById = new Map<number, Field>(board.fields.map((field) => [field.id, field]));
  const fieldByKey = new Map<string, Field>(board.fields.map((field) => [field.key, field]));
  const statusByKey = new Map<string, Status>(board.statuses.map((status) => [status.key, status]));
  const statusById = new Map<number, Status>(board.statuses.map((status) => [status.id, status]));
  const typeById = new Map<number, TicketType>(board.types.map((type) => [type.id, type]));
  const userById = new Map<number, User>(board.users.map((user) => [user.id, user]));
  const ticketById = new Map<number, BoardTicket>(
    board.tickets.map((ticket) => [ticket.id, ticket]),
  );
  const ticketByNumber = new Map<number, BoardTicket>(
    board.tickets.map((ticket) => [ticket.number, ticket]),
  );

  const optionsByFieldId = new Map<number, FieldOption[]>();
  for (const field of board.fields) {
    const active = [...field.options]
      .filter((option) => !option.archivedAt)
      .sort((left, right) => left.position - right.position);
    optionsByFieldId.set(field.id, active);
  }

  const childrenByParent = new Map<number, BoardTicket[]>();
  for (const ticket of board.tickets) {
    if (ticket.parentId !== null && !ticket.archivedAt) {
      const bucket = childrenByParent.get(ticket.parentId) ?? [];
      bucket.push(ticket);
      childrenByParent.set(ticket.parentId, bucket);
    }
  }

  const statusField = board.fields.find((field) => field.type === 'status') ?? null;

  return {
    fieldById,
    fieldByKey,
    statusByKey,
    statusById,
    typeById,
    userById,
    ticketById,
    ticketByNumber,
    optionsByFieldId,
    childrenByParent,
    statusField,
  };
}

export type BoardIndexes = ReturnType<typeof indexBoard>;
