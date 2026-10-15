import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { usePersistedState } from '@bh/hooks';
import { STORAGE_KEYS } from '../utils/storage-keys';

type CurrentUserValue = {
  userId: number | null;
  setUserId: (userId: number) => void;
};

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

// The chosen user's id is stored as its digits. A stored value that is not a
// positive integer reads as no one chosen.
const serializeUserId = (userId: number | null) => String(userId);
const parseUserId = (raw: string) => {
  const stored = Number(raw);
  return Number.isInteger(stored) && stored > 0 ? stored : undefined;
};

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  // Kept in localStorage, so the chosen user also stays in step across the app's open tabs.
  const [userId, setUserId] = usePersistedState<number | null>({
    key: STORAGE_KEYS.userId,
    defaultValue: null,
    serialize: serializeUserId,
    parse: parseUserId,
  });
  const value = useMemo(() => {
    return { userId, setUserId };
  }, [userId, setUserId]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) {
    throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  }
  return value;
}
