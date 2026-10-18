// Links into the Version page's own paths. The app's router types its routes
// and their search, which this package can't know: these take any path and a
// plain search, so an app with typed routes still compiles them.

import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

/** A path and a search, as the Version page's links name them. */
export interface AppLocation {
  to: string;
  search?: Record<string, string>;
}

interface AppLinkProps extends AppLocation {
  className?: string;
  children: ReactNode;
}

/** Link, for a path of the app's that its router's types don't list. */
export function AppLink(props: AppLinkProps) {
  // Read as it draws, not as the module loads: a test's router mock may
  // leave Link out, and importing @bh/shell must still work there.
  const link: unknown = Link;
  const Untyped = link as (props: AppLinkProps) => ReactNode;
  return <Untyped {...props} />;
}

type AppNavigate = (location: AppLocation & { replace?: boolean }) => Promise<void>;

/** useNavigate, for a path of the app's that its router's types don't list. */
export function useAppNavigate(): AppNavigate {
  // Through unknown: an app's typed navigate takes only its own paths.
  const navigate: unknown = useNavigate();
  return navigate as AppNavigate;
}
