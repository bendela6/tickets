import { describe, expect, it } from 'vitest';
import type { Board, BoardTicket } from '../types';
import { summarizeTicket } from './summarize-ticket';

const richDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'reproduce with a clean cache' }] }],
});

function makeBoard(): Board {
  return {
    project: { id: 1, key: 'TIX', name: 'Tickets', ticketPrefix: 'TIX' },
    users: [],
    types: [{ id: 1, key: 'bug', label: 'Bug', position: 0, archivedAt: null }],
    typeFields: [],
    statuses: [],
    transitions: [],
    fields: [],
    linkTypes: [],
    views: [],
    tickets: [],
  };
}

function makeTicket(overrides: Partial<BoardTicket> = {}): BoardTicket {
  return {
    id: 1,
    number: 1,
    typeId: 1,
    parentId: null,
    archivedAt: null,
    createdAt: '2026-07-16T00:00:00Z',
    updatedAt: '2026-07-16T00:00:00Z',
    values: {},
    comments: [],
    links: [],
    ...overrides,
  };
}

describe('summarizeTicket', () => {
  it('flattens a stored-doc value to plain text instead of leaking raw doc JSON', () => {
    const board = makeBoard();
    const ticket = makeTicket({ values: { title: 'Cache bug', findings: richDoc } });

    // summarizeTicket spreads the type-owned field map, so its return type
    // is a plain object shape without a `findings` field — same widening
    // the api projection's summary column has (apps/api/src/projection/
    // item-activity.test.ts casts the same way).
    const summary = summarizeTicket(board, ticket) as Record<string, unknown>;

    expect(summary.findings).toBe('reproduce with a clean cache');
    expect(String(summary.findings)).not.toContain('"type":"doc"');
  });
});
