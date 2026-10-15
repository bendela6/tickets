import { createContext } from 'react';
import type { FieldWrapperDefinition } from '../types/registry';

/**
 * The field wrapper the nearest layout that names one gives its fields; null
 * outside every such layout, where the registry's `field` draws them.
 */
export const FieldWrapperContext = createContext<FieldWrapperDefinition | null>(null);
