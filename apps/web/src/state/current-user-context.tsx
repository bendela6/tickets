import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { STORAGE_KEYS } from '../utils/storage-keys';
import { readLocal } from '../utils/read-local';
import { writeLocal } from '../utils/write-local';

type CurrentUserValue = {
  userId: number | null;
  setUserId: (userId: number) => void;
};

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<number | null>(() => {
    const stored = Number(readLocal(STORAGE_KEYS.userId));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });
  const setUserId = useCallback((next: number) => {
    setUserIdState(next);
    writeLocal(STORAGE_KEYS.userId, String(next));
  }, []);
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
