import { createRoute } from '@tanstack/react-router';
import { BoardScreen } from '../components/board-screen';
import { normalizeFilterRules, type FilterRule } from '../utils/view-config';
import { projectRoute } from './project-route';

type ViewSearch = { t?: number; q?: string; f?: FilterRule[] };

export const viewRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'v/$viewId',
  validateSearch: (search: Record<string, unknown>): ViewSearch => {
    const result: ViewSearch = {};
    const rawTicket = search.t;
    const ticketNumber = typeof rawTicket === 'number' ? rawTicket : Number(rawTicket);
    if (Number.isInteger(ticketNumber) && ticketNumber > 0) {
      result.t = ticketNumber;
    }
    if (typeof search.q === 'string' && search.q.length > 0) {
      result.q = search.q;
    }
    if (Array.isArray(search.f)) {
      result.f = normalizeFilterRules(search.f);
    }
    return result;
  },
  component: BoardScreen,
});
