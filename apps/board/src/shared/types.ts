// The API contract between src/server and src/client. Kept in src/shared so the
// client imports the same types the server serialises, with no duplication.

export type TaskStatus = 'todo' | 'in progress' | 'blocked' | 'done' | 'cancelled';

export interface Task {
  title: string;
  /** Markdown. Absent for tasks captured from a plain todo list. */
  description?: string;
  status: TaskStatus;
  /** Only set when blocked: what the task is waiting on. */
  blockedBy?: string;
  /** Minutes. Absent when never estimated. */
  estimated?: number;
  /** Minutes. Derived from how long the task sat in progress. */
  spent?: number;
}

export interface Feature {
  name: string;
  /** Markdown. */
  description?: string;
  tasks: Task[];
}

export interface Prompt {
  text: string;
  at: number | null;
}

export interface GitFile {
  code: string;
  path: string;
}

export interface GitCommit {
  sha: string;
  subject: string;
  when: string;
}

export interface GitState {
  branch: string;
  ahead: number;
  modified: number;
  untracked: number;
  files: GitFile[];
  commits: GitCommit[];
}

export type DecisionStatus = 'decided' | 'open' | 'reversed' | 'superseded';

export interface DecisionOption {
  label: string;
  detail?: string;
  recommended?: boolean;
  chosen?: boolean;
}

export interface Decision {
  id: number;
  icon?: string;
  topic?: string;
  status: DecisionStatus;
  /** Markdown. */
  context?: string;
  question?: string;
  options?: DecisionOption[];
  decided?: string;
  /** Markdown. */
  rationale?: string;
  supersededBy?: number;
}

export interface Activity {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  effort: string | null;
  tools: Array<[name: string, count: number]>;
  /** Absolute paths this session edited, newest first. */
  files: Array<{ path: string; inRepo: boolean; at: number | null }>;
  subagents: Array<{ id: string; task: string; entries: number; at: number | null }>;
  hooks: Array<{ message: string; blocked: boolean; at: number | null }>;
  skills: string[];
  /** Messages queued while busy: enqueued vs actually run. */
  queue: { enqueued: number; dequeued: number; cancelled: number };
  /** One bucket per hour of the session, for an activity timeline. */
  timeline: Array<{ at: number; count: number }>;
}

export interface SessionSummary {
  id: string;
  title: string | null;
  /** True when the title was renamed by hand rather than generated. */
  titleIsCustom: boolean;
  project: string;
  worktree: string | null;
  live: boolean;
  at: number;
  started: number | null;
  tasks: { total: number; done: number; active: number; blocked: number };
  tracked: boolean;
}

export interface SessionDetail extends SessionSummary {
  cwd: string | null;
  model: string | null;
  turns: { user: number; assistant: number };
  toolCalls: number;
  subagentCount: number;
  features: Feature[];
  prompts: Prompt[];
  git: GitState | null;
  decisions: Decision[];
  activity: Activity | null;
}

export interface ProjectSummary {
  name: string;
  count: number;
  live: number;
  open: number;
}

export interface BoardState {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
}
