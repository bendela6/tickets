import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityEntry, Item } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { DetailActivity } from './detail-activity';

const richDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the old description' }] }],
});

const activityData: ActivityEntry[] = [
  {
    id: 1,
    itemId: 10,
    eventId: 100,
    kind: 'item.field_changed',
    actorId: 1,
    at: '2026-07-16T00:00:00Z',
    correlationId: 'corr-1',
    summary: { field: 'description', from: richDoc, to: 'new plain text' },
  },
];

vi.mock('../api/use-item-activity', () => ({
  useItemActivity: () => ({ isError: false, error: null, data: activityData }),
}));

const item: Item = {
  id: 10,
  number: 1,
  typeId: 1,
  parentId: null,
  createdBy: 1,
  archivedAt: null,
  createdAt: '2026-07-16T00:00:00Z',
  updatedAt: '2026-07-16T00:00:00Z',
  values: {},
  comments: [],
  links: [],
};

const indexes = { userById: new Map() } as unknown as BoardIndexes;

describe('DetailActivity / ValueChip', () => {
  it('renders extracted plain text for a doc-JSON field value, not raw doc JSON', () => {
    render(<DetailActivity item={item} indexes={indexes} />);

    expect(screen.getByText('the old description')).toBeInTheDocument();
    expect(screen.queryByText(/"type":"doc"/)).not.toBeInTheDocument();
  });
});
