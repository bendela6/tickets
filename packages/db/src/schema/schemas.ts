import { pgSchema } from 'drizzle-orm/pg-core';

// Postgres namespaces. Every product table lives in one of these — nothing in
// public: core (shared platform primitives: users, workdirs, projects),
// structure (the items schema library), records (item data), history (the
// command/event log), plus terminal + agent for the session subsystems.
export const coreSchema = pgSchema('core');
export const terminalSchema = pgSchema('terminal');
export const agentSchema = pgSchema('agent');
export const structureSchema = pgSchema('structure');
export const recordsSchema = pgSchema('records');
export const historySchema = pgSchema('history');
