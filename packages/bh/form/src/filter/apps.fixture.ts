import type { FormConfig } from '../types/form-config';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';

// The FormConfigs of the FilterForm design's canvas (TK-75.1, version 13):
// the anatomy board's, and the seven apps' setups. Plain data, each node as
// the design writes it, less the slots and buttons, which hold no value.

type Config = FormConfig<InputRegistry, LayoutComponentRegistry>;

/** The anatomy board: tickets' board with presets, quick fields and rules. */
export const anatomy: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'wrap' },
      children: [
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search titles', shortcut: '/', commit: { after: 300 } },
        },
        {
          kind: 'field',
          name: 'presets',
          type: 'toggle-chips',
          config: {},
          filter: {
            presets: [
              { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
              {
                value: 'recent',
                label: 'Updated this week',
                filter: { field: 'updatedAt', op: 'inLast', value: 7 },
              },
              {
                value: 'unassigned',
                label: 'Unassigned',
                filter: { field: 'assignee', op: 'empty' },
              },
            ],
          },
        },
        {
          kind: 'field',
          name: 'status',
          type: 'toggle-chips',
          config: { counts: true },
          filter: { field: 'status.kind', op: 'in' },
        },
        {
          kind: 'field',
          name: 'type',
          type: 'select',
          config: { placeholder: 'any' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'rules',
          type: 'rules',
          config: { add: 'chips' },
          filter: { rules: true },
        },
      ],
    },
  ],
};

/** tickets: the title search and the rules. */
export const tickets: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'wrap' },
      children: [
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search titles', shortcut: '/', commit: { after: 300 } },
        },
        {
          kind: 'field',
          name: 'rules',
          type: 'rules',
          config: { add: 'chips' },
          filter: { rules: true },
        },
      ],
    },
  ],
};

/** items-core's crawls: presets, a site, a start segmented by map, rules in a panel. */
export const itemsCore: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'wrap' },
      children: [
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search URLs', shortcut: '/' },
        },
        {
          kind: 'field',
          name: 'presets',
          type: 'toggle-chips',
          config: {},
          filter: {
            presets: [
              {
                value: 'running',
                label: 'Running',
                filter: { field: 'status', op: 'equals', value: 'running' },
              },
              {
                value: 'failed',
                label: 'Failed today',
                filter: {
                  all: [
                    { field: 'status', op: 'equals', value: 'failed' },
                    { field: 'finishedAt', op: 'inLast', value: 1 },
                  ],
                },
              },
            ],
          },
        },
        {
          kind: 'field',
          name: 'site',
          type: 'select',
          config: { placeholder: 'any' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'started',
          type: 'segmented',
          config: { placeholder: 'Any' },
          filter: { field: 'startedAt', op: 'inLast', map: { '24h': 1, '7d': 7, '30d': 30 } },
        },
        {
          kind: 'field',
          name: 'rules',
          type: 'rules',
          config: { add: 'panel' },
          filter: { rules: true },
        },
      ],
    },
  ],
};

/** signals' issues: three selects, a last-seen select by map, a search, status tabs. */
export const signals: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'wrap' },
      children: [
        {
          kind: 'field',
          name: 'app',
          type: 'select',
          config: { placeholder: 'all' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'kind',
          type: 'select',
          config: { placeholder: 'all' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'level',
          type: 'select',
          config: { placeholder: 'all' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'lastSeen',
          type: 'select',
          defaultValue: '14 days',
          config: {},
          filter: {
            field: 'lastSeenAt',
            op: 'inLast',
            map: { '7 days': 7, '14 days': 14, '30 days': 30, '90 days': 90 },
          },
        },
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search messages', commit: { after: 300 } },
        },
      ],
    },
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'status',
          type: 'tabs',
          defaultValue: 'open',
          config: { counts: true },
          filter: { op: 'equals' },
        },
      ],
    },
  ],
};

/** medialib's library: a large segmented of presets, and two fields each shows. */
export const medialib: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'scroll' },
      children: [
        {
          kind: 'field',
          name: 'show',
          type: 'segmented',
          defaultValue: 'all',
          config: { size: 'lg', counts: true },
          filter: {
            presets: [
              { value: 'all', label: 'All', filter: { all: [] } },
              {
                value: 'unwatched',
                label: 'Unwatched',
                filter: { field: 'watchedAt', op: 'empty' },
              },
              {
                value: 'long-ago',
                label: 'Watched long ago',
                filter: { field: 'watchedAt', op: 'notEmpty' },
              },
              { value: 'by-person', label: 'By person', filter: { all: [] } },
            ],
          },
        },
      ],
    },
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'days',
          type: 'number',
          label: 'watched over',
          defaultValue: 30,
          when: { field: 'show', eq: 'long-ago' },
          config: { min: 1, suffix: 'days ago' },
          filter: { field: 'watchedAt', op: 'notInLast' },
        },
        {
          kind: 'field',
          name: 'who',
          type: 'user',
          label: 'watched by',
          when: { field: 'show', eq: 'by-person' },
          config: {},
          filter: { field: 'watchedBy', op: 'in' },
        },
      ],
    },
  ],
};

/** cv's entries: a search, and Show archived, which writes a condition while it's off. */
export const cv: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search entries' },
        },
        {
          kind: 'field',
          name: 'archived',
          type: 'checkbox',
          config: { label: 'Show archived' },
          filter: { op: 'equals', map: { false: false, true: null } },
        },
      ],
    },
  ],
};

/** wallet-passes' customers: a search and two selects. */
export const walletCustomers: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'search',
          type: 'search',
          config: { placeholder: 'Search customers' },
        },
        {
          kind: 'field',
          name: 'program',
          type: 'select',
          config: { placeholder: 'any' },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'status',
          type: 'select',
          config: { placeholder: 'any' },
          filter: { op: 'equals' },
        },
      ],
    },
  ],
};

/** wallet-passes' analytics: one day range. */
export const walletAnalytics: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'days',
          type: 'date-range',
          config: {},
          filter: { field: 'day', range: ['gte', 'lte'] },
        },
      ],
    },
  ],
};

/** session-board: a project select and a title filter. */
export const sessions: Config = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: {},
      children: [
        {
          kind: 'field',
          name: 'project',
          type: 'select',
          config: { placeholder: 'All projects', counts: true },
          filter: { op: 'equals' },
        },
        {
          kind: 'field',
          name: 'title',
          type: 'text',
          config: { placeholder: 'Filter by title…' },
          filter: { op: 'contains' },
        },
      ],
    },
  ],
};
