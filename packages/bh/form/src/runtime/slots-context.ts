import { createContext, type ReactNode } from 'react';

/** What `<Form slots>` was given: each slot's content, by its name. */
export const SlotsContext = createContext<Readonly<Record<string, ReactNode>>>({});
