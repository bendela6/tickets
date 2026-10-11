import { createContext } from 'react';
import { createResolverCache, type ResolverCache } from './resolver-cache';

export const ResolverCacheContext = createContext<ResolverCache>(createResolverCache());
