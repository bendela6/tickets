import type { SchemeDef } from './scheme-types';

const STATUS_OPTIONS = [
  { value: 'triage',      label: 'Triage',      kind: 'todo' as const },
  { value: 'backlog',     label: 'Backlog',     kind: 'todo' as const },
  { value: 'todo',        label: 'To do',       kind: 'todo' as const },
  { value: 'in-progress', label: 'In progress', kind: 'active' as const },
  { value: 'in-review',   label: 'In review',   kind: 'active' as const },
  { value: 'merged',      label: 'Merged',      kind: 'active' as const },
  { value: 'deployed',    label: 'Deployed',    kind: 'active' as const },
  { value: 'blocked',     label: 'Blocked',     kind: 'blocked' as const },
  { value: 'done',        label: 'Done',        kind: 'done' as const },
  { value: 'fixed',       label: 'Fixed',       kind: 'done' as const },
  { value: 'cancelled',   label: 'Cancelled',   kind: 'dropped' as const },
  { value: 'wont-fix',    label: "Won't fix",   kind: 'dropped' as const },
];

export const softwareScheme: SchemeDef = {
  key: 'software',
  name: 'Software',
  optionSets: [
    { key: 'status', name: 'Status', options: STATUS_OPTIONS },
    {
      key: 'priority', name: 'Priority',
      options: [
        { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        { value: 'trivial', label: 'Trivial' },
      ],
    },
    {
      key: 'kind', name: 'Kind',
      options: [
        { value: 'feat', label: 'Feature' }, { value: 'refactor', label: 'Refactor' },
        { value: 'perf', label: 'Performance' }, { value: 'chore', label: 'Chore' },
        { value: 'docs', label: 'Docs' }, { value: 'test', label: 'Test' },
      ],
    },
    {
      key: 'estimate', name: 'Estimate',
      options: [
        { value: 's', label: 'S' }, { value: 'm', label: 'M' },
        { value: 'l', label: 'L' }, { value: 'xl', label: 'XL' },
      ],
    },
    {
      key: 'severity', name: 'Severity',
      options: [
        { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        { value: 'cosmetic', label: 'Cosmetic' },
      ],
    },
    {
      key: 'environment', name: 'Environment',
      options: [
        { value: 'prod', label: 'Production' }, { value: 'staging', label: 'Staging' },
        { value: 'local', label: 'Local' },
      ],
    },
    { key: 'component', name: 'Component', options: [] }, // curated per project
    { key: 'labels', name: 'Labels', options: [] },
  ],
  fields: [
    { key: 'title',       label: 'Title',       type: 'string', system: true },
    { key: 'description', label: 'Description', type: 'string', config: { format: 'rich' } },
    { key: 'status',      label: 'Status',      type: 'option', system: true,
      optionSetKey: 'status', config: { multiple: false, workflow: true } },
    { key: 'priority',    label: 'Priority',    type: 'option', optionSetKey: 'priority', config: { multiple: false } },
    { key: 'assignee',    label: 'Assignee',    type: 'user',   config: { multiple: false } },
    { key: 'labels',      label: 'Labels',      type: 'option', optionSetKey: 'labels', config: { multiple: true } },
    { key: 'component',   label: 'Component',   type: 'option', optionSetKey: 'component', config: { multiple: false } },
    { key: 'target_date', label: 'Target date', type: 'date' },
    { key: 'estimate',    label: 'Estimate',    type: 'option', optionSetKey: 'estimate', config: { multiple: false } },
    { key: 'pr',          label: 'PR',          type: 'string' },
    { key: 'environment', label: 'Environment', type: 'option', optionSetKey: 'environment', config: { multiple: false } },
    { key: 'findings',    label: 'Findings',    type: 'string', config: { format: 'markdown' } },
    { key: 'kind',        label: 'Kind',        type: 'option', optionSetKey: 'kind', config: { multiple: false } },
    { key: 'severity',    label: 'Severity',    type: 'option', optionSetKey: 'severity', config: { multiple: false } },
    { key: 'steps',       label: 'Steps',       type: 'string', config: { format: 'markdown' } },
  ],
  types: [
    {
      key: 'epic', label: 'Epic', config: { color: '#8f7ae8' },
      allowedChildTypes: ['task', 'bug', 'spike'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['backlog', 'in-progress', 'blocked', 'done', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'target_date' },
      ],
    },
    {
      key: 'task', label: 'Task', config: { color: '#3987e5' },
      allowedChildTypes: ['subtask'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['backlog', 'todo', 'in-progress', 'in-review', 'merged', 'deployed', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'estimate' }, { fieldKey: 'kind' }, { fieldKey: 'pr' },
      ],
    },
    {
      key: 'bug', label: 'Bug', config: { color: '#d03b3b' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['triage', 'todo', 'in-progress', 'in-review', 'merged', 'deployed', 'fixed', 'blocked', 'wont-fix'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'severity' }, { fieldKey: 'environment' },
        { fieldKey: 'steps' },
      ],
    },
    {
      key: 'spike', label: 'Spike', config: { color: '#e5a339' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['todo', 'in-progress', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'component' },
        { fieldKey: 'labels' }, { fieldKey: 'target_date' }, { fieldKey: 'findings' },
      ],
    },
    {
      key: 'subtask', label: 'Subtask', config: { color: '#4aa3a3' },
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status',
          allowedOptionValues: ['todo', 'in-progress', 'in-review', 'done', 'blocked', 'cancelled'] },
        { fieldKey: 'priority' }, { fieldKey: 'assignee' }, { fieldKey: 'estimate' },
      ],
    },
  ],
  transitions: [
    // status is a shared field; a null typeKey means "every type using it".
    // Start states, per type:
    { fieldKey: 'status', fromValue: null, toValue: 'backlog',     typeKey: 'epic' },
    { fieldKey: 'status', fromValue: null, toValue: 'backlog',     typeKey: 'task' },
    { fieldKey: 'status', fromValue: null, toValue: 'triage',      typeKey: 'bug' },
    { fieldKey: 'status', fromValue: null, toValue: 'todo',        typeKey: 'spike' },
    { fieldKey: 'status', fromValue: null, toValue: 'todo',        typeKey: 'subtask' },
    // Everything else is unrestricted for now: an empty edge set for a
    // (field, type) pair means "any transition allowed" — the option_transitions
    // table (this scheme's equivalent of the old, now-removed status_transitions
    // table) has no rows constraining it.
  ],
  linkTypes: [
    { key: 'blocks',     label: 'Blocks',     inverseLabel: 'Blocked by',   directional: true,  ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug', 'epic', 'spike', 'subtask'] },
    { key: 'relates-to', label: 'Relates to', inverseLabel: 'Relates to',   directional: false, ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug', 'epic', 'spike', 'subtask'] },
    { key: 'duplicates', label: 'Duplicates', inverseLabel: 'Duplicated by', directional: true, ownerTypeKey: 'task', targetTypeKeys: ['task', 'bug'] },
  ],
  defaultView: {
    name: 'All items',
    columns: [
      { source: 'number' }, { source: 'type' },
      { source: 'field', fieldKey: 'title' },
      { source: 'field', fieldKey: 'status' },
      { source: 'field', fieldKey: 'priority' },
      { source: 'field', fieldKey: 'assignee' },
    ],
    sort: { source: 'number', dir: 'desc' },
  },
};
