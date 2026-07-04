import { createRoute } from '@tanstack/react-router';
import { BoardScreen } from '../components/board-screen';
import { projectRoute } from './project-route';

export const viewRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'v/$viewId',
  validateSearch: (search: Record<string, unknown>): { t?: number } => {
    const raw = search.t;
    const number = typeof raw === 'number' ? raw : Number(raw);
    return Number.isInteger(number) && number > 0 ? { t: number } : {};
  },
  component: BoardScreen,
});
