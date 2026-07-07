import type { FieldDef, LinkTypeDef, SchemeDef, StatusDef, TypeDef, ViewDef } from './scheme-types';

const KIND_COLORS = {
  todo: '#3987e5',
  active: '#8f7ae8',
  blocked: '#d03b3b',
  done: '#0ca30c',
  dropped: '#898781',
} as const;

// helper so status color always tracks kind
const s = (key: string, label: string, kind: StatusDef['kind'], initial = false): StatusDef => ({
  key,
  label,
  kind,
  ...(initial ? { initial: true } : {}),
});

const types: TypeDef[] = [
  {
    key: 'epic',
    label: 'Epic',
    color: '#8f7ae8',
    statuses: [
      s('backlog', 'Backlog', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('blocked', 'Blocked', 'blocked'),
      s('done', 'Done', 'done'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: [
      'title',
      'description',
      'status',
      'priority',
      'assignee',
      'component',
      'labels',
      'target_date',
    ],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'task',
    label: 'Task',
    color: '#3987e5',
    statuses: [
      s('backlog', 'Backlog', 'todo', true),
      s('todo', 'To do', 'todo'),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('merged', 'Merged', 'active'),
      s('deployed', 'Deployed', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: [
      'title',
      'description',
      'status',
      'priority',
      'assignee',
      'kind',
      'component',
      'labels',
      'pr',
      'target_date',
      'estimate',
    ],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'bug',
    label: 'Bug',
    color: '#d03b3b',
    statuses: [
      s('triage', 'Triage', 'todo', true),
      s('todo', 'To do', 'todo'),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('merged', 'Merged', 'active'),
      s('deployed', 'Deployed', 'active'),
      s('fixed', 'Fixed', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('wont-fix', "Won't fix", 'dropped'),
    ],
    fieldKeys: [
      'title',
      'description',
      'status',
      'priority',
      'assignee',
      'component',
      'labels',
      'severity',
      'steps',
      'environment',
      'pr',
      'estimate',
    ],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'subtask',
    label: 'Subtask',
    color: '#898781',
    statuses: [
      s('todo', 'To do', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('in-review', 'In review', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: ['title', 'description', 'status', 'priority', 'assignee', 'labels'],
    requiredFieldKeys: ['title'],
  },
  {
    key: 'spike',
    label: 'Spike',
    color: '#fab219',
    statuses: [
      s('todo', 'To do', 'todo', true),
      s('in-progress', 'In progress', 'active'),
      s('done', 'Done', 'done'),
      s('blocked', 'Blocked', 'blocked'),
      s('cancelled', 'Cancelled', 'dropped'),
    ],
    fieldKeys: [
      'title',
      'description',
      'status',
      'priority',
      'assignee',
      'component',
      'labels',
      'findings',
      'target_date',
    ],
    requiredFieldKeys: ['title'],
  },
];

const fields: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', system: true, config: { widget: 'input' } },
  { key: 'description', label: 'Description', type: 'text', system: true, config: { widget: 'markdown' } },
  { key: 'status', label: 'Status', type: 'status', system: true },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: true,
    config: { description: 'When this should get done, in order. Default Medium.' },
    options: [
      { value: 'urgent', label: 'Urgent', color: '#d03b3b' },
      { value: 'high', label: 'High', color: '#fab219' },
      { value: 'medium', label: 'Medium', color: '#3987e5' },
      { value: 'low', label: 'Low', color: '#898781' },
      { value: 'trivial', label: 'Trivial', color: '#b8b6b0' },
    ],
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'select',
    system: true,
    config: {
      description:
        'Which Claude model this ticket is assigned to. When planning, decide which model fits and set it: claude-fable-5 for the hardest reasoning/agentic work, claude-opus-4-8 for hard coding/agentic tasks, claude-sonnet-5 for well-specified implementation, claude-haiku-4-5 for quick mechanical changes.',
    },
    options: [
      { value: 'claude-fable-5', label: 'Fable 5', color: '#8f7ae8' },
      { value: 'claude-opus-4-8', label: 'Opus 4.8', color: '#3987e5' },
      { value: 'claude-sonnet-5', label: 'Sonnet 5', color: '#0ca30c' },
      { value: 'claude-haiku-4-5', label: 'Haiku 4.5', color: '#898781' },
    ],
  },
  {
    key: 'kind',
    label: 'Kind',
    type: 'select',
    config: { description: 'Flavor of change; matches the conventional-commit prefix.' },
    options: [
      { value: 'feat', label: 'Feature' },
      { value: 'refactor', label: 'Refactor' },
      { value: 'perf', label: 'Perf' },
      { value: 'chore', label: 'Chore' },
      { value: 'docs', label: 'Docs' },
      { value: 'test', label: 'Test' },
    ],
  },
  {
    key: 'component',
    label: 'Component',
    type: 'select',
    options: [
      { value: 'api', label: 'api' },
      { value: 'web', label: 'web' },
      { value: 'mcp', label: 'mcp' },
      { value: 'db', label: 'db' },
    ],
  },
  { key: 'labels', label: 'Labels', type: 'multi_select', options: [] },
  {
    key: 'severity',
    label: 'Severity',
    type: 'select',
    options: [
      { value: 'critical', label: 'Critical', color: '#d03b3b' },
      { value: 'high', label: 'High', color: '#fab219' },
      { value: 'medium', label: 'Medium', color: '#3987e5' },
      { value: 'low', label: 'Low', color: '#898781' },
      { value: 'cosmetic', label: 'Cosmetic', color: '#b8b6b0' },
    ],
  },
  { key: 'steps', label: 'Steps to reproduce', type: 'text', config: { widget: 'markdown' } },
  {
    key: 'environment',
    label: 'Environment',
    type: 'select',
    options: [
      { value: 'prod', label: 'prod' },
      { value: 'staging', label: 'staging' },
      { value: 'local', label: 'local' },
    ],
  },
  { key: 'pr', label: 'PR / Branch', type: 'text', config: { widget: 'link' } },
  { key: 'findings', label: 'Findings', type: 'text', config: { widget: 'markdown' } },
  { key: 'target_date', label: 'Target date', type: 'date' },
  {
    key: 'estimate',
    label: 'Estimate',
    type: 'select',
    options: [
      { value: 's', label: 'S' },
      { value: 'm', label: 'M' },
      { value: 'l', label: 'L' },
      { value: 'xl', label: 'XL' },
    ],
  },
];

const linkTypes: LinkTypeDef[] = [
  { key: 'blocks', label: 'blocks', inverseLabel: 'is blocked by', directional: true },
  { key: 'relates-to', label: 'relates to', inverseLabel: 'relates to', directional: false },
  { key: 'duplicates', label: 'duplicates', inverseLabel: 'is duplicated by', directional: true },
  { key: 'caused-by', label: 'caused by', inverseLabel: 'causes', directional: true },
];

const defaultView: ViewDef = {
  name: 'Default',
  columns: [
    { source: 'number' },
    { source: 'type' },
    { source: 'field', fieldKey: 'title' },
    { source: 'field', fieldKey: 'priority' },
    { source: 'field', fieldKey: 'assignee' },
    { source: 'progress' },
    { source: 'field', fieldKey: 'status' },
  ],
  sort: { source: 'field', fieldKey: 'priority', dir: 'desc' },
};

export const SOFTWARE_SCHEME: SchemeDef = {
  key: 'software',
  name: 'Software',
  description: 'Default software-delivery structure: Epic / Task / Bug / Subtask / Spike.',
  types,
  fields,
  linkTypes,
  defaultView,
};

export { KIND_COLORS };
