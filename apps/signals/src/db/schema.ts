import {
  bigint, bigserial, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { SignalPayload } from '../types';

export const apps = pgTable('apps', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ingestKey: text('ingest_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issues = pgTable(
  'issues',
  {
    // rendered "SGL-<id>" in API responses and the UI
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    culprit: text('culprit'),
    status: text('status', { enum: ['open', 'resolved', 'ignored'] }).notNull().default('open'),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
    eventCount: bigint('event_count', { mode: 'number' }).notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('issues_app_fingerprint').on(t.appId, t.fingerprint)],
);

export const signals = pgTable(
  'signals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    kind: text('kind', { enum: ['error', 'log', 'event'] }).notNull(),
    sessionId: text('session_id').notNull(),
    name: text('name').notNull(),
    message: text('message'),
    mechanism: text('mechanism').notNull(),
    level: text('level', { enum: ['error', 'warning', 'info'] }).notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    release: text('release'),
    environment: text('environment'),
    issueId: bigint('issue_id', { mode: 'number' }).references(() => issues.id),
    payload: jsonb('payload').notNull().$type<SignalPayload>(),
  },
  (t) => [
    index('signals_session').on(t.sessionId),
    index('signals_issue').on(t.issueId),
    index('signals_app_received').on(t.appId, t.receivedAt),
  ],
);

export const sourcemapArtifacts = pgTable(
  'sourcemap_artifacts',
  {
    id: serial('id').primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    release: text('release').notNull(),
    filename: text('filename').notNull(),
    // raw JSON text of the .map file
    content: text('content').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sourcemaps_app_release').on(t.appId, t.release)],
);
