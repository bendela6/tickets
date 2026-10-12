import { createRoute } from '@tanstack/react-router';
import { BoardScreen } from '../components/board-screen';
import { normalizeFilterRules, type FilterRule } from '../utils/view-config';
import { projectRoute } from './project-route';

// t: the open item's key. An old link's number is kept as its digits, and
// BoardScreen swaps it for the key.
type ViewSearch = { t?: string; q?: string; f?: FilterRule[] };

export const viewRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'v/$viewId',
  validateSearch: (search: Record<string, unknown>): ViewSearch => {
    const result: ViewSearch = {};
    const rawTicket = search.t;
    if (typeof rawTicket === 'number' && Number.isInteger(rawTicket) && rawTicket > 0) {
      result.t = String(rawTicket);
    } else if (typeof rawTicket === 'string' && rawTicket.length > 0) {
      result.t = rawTicket;
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
