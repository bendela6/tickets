import type { FormConfig, InputRegistry, LayoutComponentRegistry } from '@bh/form';
import type { FieldMeta, OptionMeta, ResourceMeta } from '@bh/resource';

// The seven apps' filter forms from the FilterForm design's canvas (TK-75.1),
// each over a made-up resource: what the end-to-end test draws with bh's
// own registry. Each bar is told to keep its first fields below 640 pixels.

export type Config = FormConfig<InputRegistry, LayoutComponentRegistry>;
type Node = Config['nodes'][number];

/** Options of an option field, in order. */
function options(...labels: [string, string, string?][]): OptionMeta[] {
  return labels.map(([value, label, color], order) => {
    return { value, label, order, ...(color ? { color } : {}) };
  });
}

/** A field of a kind, filtered by `filter`'s operators. */
function field(
  key: string,
  label: string,
  type: FieldMeta['type'],
  filter: string[],
  search = false,
): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: type.many !== true, group: false, search },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];
const TIMES = ['lt', 'lte', 'gt', 'gte', 'inLast', 'notInLast', 'empty', 'notEmpty'];
const TEXT = ['contains', 'startsWith', 'empty', 'notEmpty'];

/** A resource of these fields, its rows named by `title`. */
function resource(name: string, one: string, other: string, fields: FieldMeta[]): ResourceMeta {
  return {
    resource: name,
    label: { one, other },
    roles: { idField: 'id', titleField: fields[0]?.key ?? 'id' },
    fields,
    sort: [],
    actions: [],
    serves: {
      read: true,
      create: true,
      update: true,
      delete: true,
      filter: { any: true, not: true },
      sort: { max: 3 },
      page: { numbered: 'any', cursor: false, total: true, max: 100 },
    },
  };
}

/** A field node. */
function node(
  name: string,
  type: string,
  config: Record<string, unknown>,
  more: Record<string, unknown> = {},
): Node {
  return { kind: 'field', name, type, config, ...more };
}

/** A bar: one inline row, told what to keep below 640 pixels, with a Clear. */
function bar(keep: string[], children: Node[], props: Record<string, unknown> = {}): Node {
  return {
    kind: 'inline',
    props: { overflow: 'wrap', narrow: { below: 640, keep }, ...props },
    children: [
      ...children,
      { kind: 'slot', name: 'count' },
      { kind: 'action', action: 'reset', label: 'Clear', to: 'start' },
    ],
  };
}

const STATUSES = options(
  ['new', 'New', 'gray'],
  ['active', 'Active', 'blue'],
  ['done', 'Done', 'success'],
);

/** One app's filter form and the resource it filters. */
export interface App {
  name: string;
  form: Config;
  meta: ResourceMeta;
}

export const tickets: App = {
  name: 'tickets',
  meta: resource('tickets', 'item', 'items', [
    field('title', 'Title', { kind: 'text' }, TEXT, true),
    field('status', 'Status', { kind: 'option', settings: { options: STATUSES } }, LISTS),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('due', 'Due', { kind: 'date' }, TIMES),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['search'],
        [
          node('search', 'search', { placeholder: 'Search titles', shortcut: '/' }),
          node('rules', 'rules', { add: 'chips' }, { label: 'Filters', filter: { rules: true } }),
        ],
      ),
    ],
  },
};

export const itemsCore: App = {
  name: 'items-core',
  meta: resource('crawls', 'crawl', 'crawls', [
    field('url', 'URL', { kind: 'text' }, TEXT, true),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: options(['running', 'Running'], ['failed', 'Failed'], ['done', 'Done']),
        },
      },
      LISTS,
    ),
    field('finishedAt', 'Finished', { kind: 'datetime' }, TIMES),
    field(
      'site',
      'Site',
      { kind: 'option', settings: { options: options(['docs', 'Docs'], ['shop', 'Shop']) } },
      LISTS,
    ),
    field('startedAt', 'Started', { kind: 'datetime' }, TIMES),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['search', 'presets'],
        [
          node('search', 'search', { placeholder: 'Search URLs', shortcut: '/' }),
          node(
            'presets',
            'toggle-chips',
            {},
            {
              label: 'Presets',
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
          ),
          node('site', 'select', { placeholder: 'any' }, { filter: { op: 'equals' } }),
          node(
            'started',
            'segmented',
            { placeholder: 'Any', size: 'xs' },
            {
              filter: { field: 'startedAt', op: 'inLast', map: { '24h': 1, '7d': 7, '30d': 30 } },
            },
          ),
          node('rules', 'rules', { add: 'panel' }, { label: 'Filters', filter: { rules: true } }),
        ],
      ),
    ],
  },
};

export const signals: App = {
  name: 'signals',
  meta: resource('issues', 'issue', 'issues', [
    field('message', 'Message', { kind: 'text' }, TEXT, true),
    field(
      'app',
      'App',
      { kind: 'option', settings: { options: options(['web', 'web'], ['api', 'api']) } },
      LISTS,
    ),
    field(
      'kind',
      'Kind',
      { kind: 'option', settings: { options: options(['error', 'Error'], ['log', 'Log']) } },
      LISTS,
    ),
    field(
      'level',
      'Level',
      {
        kind: 'option',
        settings: {
          options: options(['fatal', 'Fatal', 'danger'], ['warning', 'Warning', 'warning']),
        },
      },
      LISTS,
    ),
    field('lastSeenAt', 'Last seen', { kind: 'datetime' }, TIMES),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: options(['open', 'Open'], ['resolved', 'Resolved'], ['ignored', 'Ignored']),
        },
      },
      LISTS,
    ),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['search'],
        [
          node('app', 'select', { placeholder: 'all' }, { filter: { op: 'equals' } }),
          node('kind', 'select', { placeholder: 'all' }, { filter: { op: 'equals' } }),
          node('level', 'select', { placeholder: 'all' }, { filter: { op: 'equals' } }),
          node(
            'lastSeen',
            'select',
            { placeholder: 'any time' },
            {
              label: 'Last seen',
              filter: {
                field: 'lastSeenAt',
                op: 'inLast',
                map: { '7 days': 7, '14 days': 14, '30 days': 30, '90 days': 90 },
              },
            },
          ),
          node('search', 'search', { placeholder: 'Search messages', commit: { after: 300 } }),
        ],
      ),
      {
        kind: 'inline',
        props: {},
        children: [node('status', 'tabs', { counts: true }, { filter: { op: 'equals' } })],
      },
    ],
  },
};

export const medialib: App = {
  name: 'medialib',
  meta: resource('media', 'title', 'titles', [
    field('name', 'Name', { kind: 'text' }, TEXT, true),
    field('watchedAt', 'Watched', { kind: 'datetime' }, TIMES),
    field('watchedBy', 'Watched by', { kind: 'ref', settings: { of: 'users' }, many: true }, [
      'in',
      'notIn',
      'empty',
      'notEmpty',
      'isMe',
    ]),
  ]),
  form: {
    commit: 'change',
    nodes: [
      {
        kind: 'inline',
        props: { overflow: 'scroll', narrow: { below: 640, keep: ['show'] } },
        children: [
          node(
            'show',
            'segmented',
            { size: 'lg', counts: true },
            {
              label: 'Show',
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
          ),
          node(
            'days',
            'number',
            { min: 1 },
            {
              label: 'watched over',
              when: { field: 'show', eq: 'long-ago' },
              filter: { field: 'watchedAt', op: 'notInLast' },
            },
          ),
          node(
            'who',
            'user',
            { multiple: true },
            {
              label: 'watched by',
              when: { field: 'show', eq: 'by-person' },
              filter: { field: 'watchedBy', op: 'in' },
            },
          ),
          { kind: 'action', action: 'reset', label: 'Clear', to: 'start' },
        ],
      },
    ],
  },
};

export const cv: App = {
  name: 'cv',
  meta: resource('entries', 'entry', 'entries', [
    field('title', 'Title', { kind: 'text' }, TEXT, true),
    field('archived', 'Archived', { kind: 'boolean' }, ['equals']),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['search'],
        [
          node('search', 'search', { placeholder: 'Search entries' }),
          node(
            'archived',
            'checkbox',
            { label: 'Show archived' },
            { filter: { op: 'equals', map: { false: false, true: null } } },
          ),
        ],
      ),
    ],
  },
};

export const walletPasses: App = {
  name: 'wallet-passes',
  meta: resource('customers', 'customer', 'customers', [
    field('name', 'Name', { kind: 'text' }, TEXT, true),
    field(
      'program',
      'Program',
      {
        kind: 'option',
        settings: { options: options(['coffee', 'Coffee club'], ['books', 'Book club']) },
      },
      LISTS,
    ),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: { options: options(['active', 'Active'], ['lapsed', 'Lapsed']) },
      },
      LISTS,
    ),
    field('day', 'Day', { kind: 'date' }, TIMES),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['search'],
        [
          node('search', 'search', { placeholder: 'Search customers' }),
          node('program', 'select', { placeholder: 'any' }, { filter: { op: 'equals' } }),
          node('status', 'select', { placeholder: 'any' }, { filter: { op: 'equals' } }),
          node(
            'days',
            'date-range',
            {},
            { label: 'Days', filter: { field: 'day', range: ['gte', 'lte'] } },
          ),
        ],
      ),
    ],
  },
};

export const sessionBoard: App = {
  name: 'session-board',
  meta: resource('sessions', 'session', 'sessions', [
    field('title', 'Title', { kind: 'text' }, TEXT, true),
    field(
      'project',
      'Project',
      { kind: 'option', settings: { options: options(['bh', 'bh'], ['tickets', 'tickets']) } },
      LISTS,
    ),
  ]),
  form: {
    commit: 'change',
    nodes: [
      bar(
        ['project'],
        [
          node(
            'project',
            'select',
            { placeholder: 'All projects', counts: true },
            { filter: { op: 'equals' } },
          ),
          node(
            'title',
            'text',
            { placeholder: 'Filter by title…' },
            { filter: { op: 'contains' } },
          ),
        ],
      ),
    ],
  },
};
