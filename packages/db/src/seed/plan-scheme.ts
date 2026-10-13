import type { SchemeDef } from './scheme-types';

// The plans' shape (`tasks/tasks.schema.json`) as a scheme: an epic holds
// features, a feature tickets, a ticket subtickets, and a subticket
// subtickets of its own.

// One shared status set; each type keeps its own subset (the allowlists below).
// A feature has the plans' six statuses, a ticket `done` as To do / Done, and
// both can be cancelled: Cancelled is of kind dropped, so a cancelled item is
// never done, and restoring one (item.update's `restoreStatus`) returns it to
// the status it had before.
const STATUS_OPTIONS = [
  { value: 'not-planned', label: 'Not planned', kind: 'todo' as const },
  { value: 'planning',    label: 'Planning',    kind: 'todo' as const },
  { value: 'planned',     label: 'Planned',     kind: 'todo' as const },
  { value: 'designed',    label: 'Designed',    kind: 'todo' as const },
  { value: 'todo',        label: 'To do',       kind: 'todo' as const },
  { value: 'in-progress', label: 'In progress', kind: 'active' as const },
  { value: 'done',        label: 'Done',        kind: 'done' as const },
  { value: 'cancelled',   label: 'Cancelled',   kind: 'dropped' as const },
];

const PLAN_TYPES = ['epic', 'feature', 'ticket', 'subticket'];

const FEATURE_STATUSES =['not-planned', 'planning', 'planned', 'designed', 'in-progress', 'done', 'cancelled'];
const TICKET_STATUSES = ['todo', 'done', 'cancelled'];

// The repositories a plan's `where` may name: the `repo` enum of
// `tasks/tasks.schema.json`, each option's value the repo's name as `where`
// writes it, so `repos` follows `where` without a mapping.
export const PLAN_REPOS = [
  'tickets', 'bh', 'gateway', 'live gateway', 'items-core', 'items-infrastructure', 'medialib',
  'signals', 'cv', 'wallet-passes', 'icon-editor', 'session-board', 'auth', 'gcp',
];

export const planScheme: SchemeDef = {
  key: 'plan',
  name: 'Plan',
  // A plan project: an epic's key is PREFIX/E<n>, a feature's PREFIX-<n>, a
  // ticket's or a subticket's its parent's and .<n>; set when the item is made,
  // never changed, so an item never moves to another parent.
  config: { plan: true },
  optionSets: [
    { key: 'status', name: 'Status', options: STATUS_OPTIONS },
    { key: 'repos', name: 'Repos', options: PLAN_REPOS.map((repo) => ({ value: repo, label: repo })) },
  ],
  fields: [
    { key: 'title',       label: 'Title',       type: 'string', system: true },
    { key: 'description', label: 'Description', type: 'string', config: { format: 'markdown' } },
    { key: 'status',      label: 'Status',      type: 'option', system: true,
      optionSetKey: 'status', config: { multiple: false, workflow: true } },
    { key: 'statusNote',  label: 'Status note', type: 'string', config: { format: 'markdown' } },
    // Words, several: what it waits for that isn't an item. A JSON array of
    // strings, since a text field holds one value per item.
    { key: 'waitingOn',   label: 'Waiting on',  type: 'json' },
    // [{ repo, part }] in order: where it's built.
    { key: 'where',       label: 'Where',       type: 'json' },
    // The repos `where` names, kept in step with it by the `repos-from-where`
    // automation, so a list filters and groups by repo.
    { key: 'repos',       label: 'Repos',       type: 'option', optionSetKey: 'repos', config: { multiple: true } },
    { key: 'today',       label: 'Today',       type: 'string', config: { format: 'markdown' } },
    { key: 'stays',       label: 'Stays',       type: 'string', config: { format: 'markdown' } },
    { key: 'rule',        label: 'Rule',        type: 'string', config: { format: 'markdown' } },
    { key: 'chosen',      label: 'Chosen',      type: 'string', config: { format: 'markdown' } },
    { key: 'chosenOn',    label: 'Chosen on',   type: 'date' },
    { key: 'design',      label: 'Design',      type: 'string', config: { format: 'markdown' } },
    // The plans' `byYou`: an item assigned to a human user is the user's own,
    // and the builder leaves it alone.
    { key: 'assignee',    label: 'Assignee',    type: 'user',   config: { multiple: false } },
  ],
  types: [
    {
      key: 'epic', label: 'Epic', config: { color: 'indigo' },
      allowedChildTypes: ['feature'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status', allowedOptionValues: TICKET_STATUSES },
      ],
    },
    {
      key: 'feature', label: 'Feature', config: { color: 'blue' },
      allowedChildTypes: ['ticket'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status', allowedOptionValues: FEATURE_STATUSES },
        { fieldKey: 'statusNote' },
        { fieldKey: 'waitingOn' },
        { fieldKey: 'where', required: true },
        { fieldKey: 'repos' },
        { fieldKey: 'today' },
        { fieldKey: 'stays' },
        { fieldKey: 'rule' },
        { fieldKey: 'chosen' },
        { fieldKey: 'chosenOn' },
        { fieldKey: 'design' },
      ],
    },
    {
      key: 'ticket', label: 'Ticket', config: { color: 'teal' },
      allowedChildTypes: ['subticket'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status', allowedOptionValues: TICKET_STATUSES },
        { fieldKey: 'where' },
        { fieldKey: 'repos' },
        { fieldKey: 'assignee' },
      ],
    },
    {
      key: 'subticket', label: 'Subticket', config: { color: 'orange' },
      allowedChildTypes: ['subticket'],
      placements: [
        { fieldKey: 'title', required: true },
        { fieldKey: 'description' },
        { fieldKey: 'status', allowedOptionValues: TICKET_STATUSES },
        { fieldKey: 'where' },
        { fieldKey: 'repos' },
        { fieldKey: 'assignee' },
      ],
    },
  ],
  // No edges: a status moves freely, as in the plans today, where any status
  // may be written at any time (an empty edge set for a field means any move
  // and any starting option is allowed). A new item without a status starts
  // at its type's first todo option: Not planned for a feature, To do for the
  // rest.
  transitions: [],
  // Blockers: every type owns a `blocks` link type that targets every type, so
  // any plan item, an epic too, may wait on any other. As the software
  // scheme's, the source blocks the target: the plans' `X.blockedBy: [{ id: Y,
  // why }]` is a link from Y to X whose why is why X waits on Y. The API
  // requires the why and keeps the plans' rules on them (item.link).
  linkTypes: PLAN_TYPES.map((ownerTypeKey) => ({
    key: 'blocks', label: 'Blocks', inverseLabel: 'Blocked by', directional: true,
    ownerTypeKey, targetTypeKeys: PLAN_TYPES,
  })),
  defaultView: {
    name: 'All items',
    columns: [
      { source: 'number' }, { source: 'type' },
      { source: 'field', fieldKey: 'title' },
      { source: 'field', fieldKey: 'status' },
      { source: 'field', fieldKey: 'repos' },
      { source: 'field', fieldKey: 'assignee' },
    ],
    sort: { source: 'number', dir: 'asc' },
  },
};
