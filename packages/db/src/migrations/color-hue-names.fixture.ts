// bh's eleven hues (@bh/ui's HUES), which this package doesn't depend on.
export const HUES = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
] as const;
export type Hue = (typeof HUES)[number];

// Every hex config.color held before migration 0008 (TK-5.21.1), with the hue
// the web's hexToOptionColor gave it then: what each one looked like, and so
// what the migration must turn it into.
export interface StoredColor {
  hex: string;
  hue: Hue;
  // where it was stored: the seed's scheme and type, or the live table and,
  // for an option, its option set
  from: string;
}

// The seed's (packages/db/src/seed), before it wrote names: types only, since
// no seeded option carried a color.
export const SEED_COLORS: StoredColor[] = [
  { hex: '#8f7ae8', hue: 'indigo', from: 'software and plan schemes: epic' },
  { hex: '#3987e5', hue: 'blue', from: 'software scheme: task; plan scheme: feature' },
  { hex: '#d03b3b', hue: 'red', from: 'software scheme: bug' },
  { hex: '#e5a339', hue: 'orange', from: 'software scheme: spike; plan scheme: subticket' },
  { hex: '#4aa3a3', hue: 'teal', from: 'software scheme: subtask; plan scheme: ticket' },
];

// The live database's, read from its read-only backup of 2026-10-12
// (tickets-backups/2026-10-13-older-projects, structure.options and
// structure.item_types restored alone): each distinct value, by table.
export const LIVE_COLORS: StoredColor[] = [
  { hex: '#0ca30c', hue: 'green', from: 'options: status' },
  { hex: '#3987e5', hue: 'blue', from: 'options: priority, severity, status' },
  { hex: '#898781', hue: 'gray', from: 'options: priority, severity, status' },
  { hex: '#8f7ae8', hue: 'indigo', from: 'options: status' },
  { hex: '#b8b6b0', hue: 'gray', from: 'options: priority, severity' },
  { hex: '#d03b3b', hue: 'red', from: 'options: priority, severity, status' },
  { hex: '#fab219', hue: 'yellow', from: 'options: priority, severity' },
  { hex: '#2E7D4F', hue: 'green', from: 'item_types: document' },
  { hex: '#3987e5', hue: 'blue', from: 'item_types: task' },
  { hex: '#898781', hue: 'gray', from: 'item_types: subtask' },
  { hex: '#8f7ae8', hue: 'indigo', from: 'item_types: epic' },
  { hex: '#d03b3b', hue: 'red', from: 'item_types: bug' },
  { hex: '#fab219', hue: 'yellow', from: 'item_types: spike' },
];
