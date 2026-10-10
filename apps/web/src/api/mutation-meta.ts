// Every failed mutation is toasted (MutationErrorToasts) unless the screen
// that ran it shows the error itself. Such a screen builds its hook with
// OWN_ERROR, so the message isn't shown twice.
export interface TicketsMutationMeta extends Record<string, unknown> {
  showsOwnError?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: TicketsMutationMeta;
  }
}

export type MutationHookOptions = { meta?: TicketsMutationMeta };

export const OWN_ERROR: MutationHookOptions = { meta: { showsOwnError: true } };

/** For `void save().catch(toasted)`: MutationErrorToasts has already shown
 *  the failure, so this only keeps the rejection from going unhandled. */
export function toasted(): void {}
