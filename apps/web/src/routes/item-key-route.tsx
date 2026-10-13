import { Link, Navigate, createRoute } from '@tanstack/react-router';
import { useItemByKey } from '../api/use-item-by-key';
import { rootRoute } from './root-route';

// /i/<key>: an item by its key alone, wherever it is written (a key is unique
// across every project), sent on to its page in its project.
function ItemKeyScreen() {
  const { itemKey } = itemKeyRoute.useParams();
  const found = useItemByKey(itemKey);
  if (found.data) {
    return (
      <Navigate
        to="/p/$projectKey/t/$itemKey"
        params={{ projectKey: found.data.projectKey, itemKey: found.data.key }}
        replace
      />
    );
  }
  return (
    <div className="px-32 py-28">
      {found.isError ? (
        <>
          <p className="font-sans text-13/19 text-red-9">{(found.error as Error).message}</p>
          <Link
            to="/"
            className="mt-12 inline-flex h-32 items-center rounded-8 border-1 border-gray-7 bg-surface-raised px-12 font-sans text-13/19 text-gray-12 hover:bg-surface-inset"
          >
            ← projects
          </Link>
        </>
      ) : (
        <p className="font-sans text-13/19 text-gray-9">Finding {itemKey}…</p>
      )}
    </div>
  );
}

export const itemKeyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/i/$itemKey',
  component: ItemKeyScreen,
});
