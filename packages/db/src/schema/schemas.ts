import { pgSchema } from 'drizzle-orm/pg-core';

// Namespaces. Product tables move in Plan 2; these three land now.
export const coreSchema = pgSchema('core');
export const terminalSchema = pgSchema('terminal');
export const agentSchema = pgSchema('agent');
export const structureSchema = pgSchema('structure');
export const recordsSchema = pgSchema('records');
export const historySchema = pgSchema('history');
