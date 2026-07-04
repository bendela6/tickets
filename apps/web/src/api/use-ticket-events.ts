import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { TicketEventsResponse } from './types';

export function useTicketEvents(ticketId: number | null, take?: number) {
  return useQuery({
    queryKey: ['ticket-events', ticketId, take ?? null],
    queryFn: () => {
      const query = take === undefined ? '' : `?take=${take}`;
      return fetchJson<TicketEventsResponse>(`/api/tickets/${ticketId}/events${query}`);
    },
    enabled: ticketId !== null,
  });
}
