import fs from 'node:fs';
import path from 'node:path';
import type {
  BoardState,
  Decision,
  Feature,
  ProjectSummary,
  SessionDetail,
  SessionSummary,
  Task,
  TaskStatus,
} from '../shared/types.js';
import { readGit } from './git.js';
import { CLAUDE, findScratchpad, GUARD, labelFromCwd, labelFromSlug, PROJECTS } from './paths.js';
import { readTitles } from './titles.js';
import { readSubagents, readTranscript, spentMinutes, type TranscriptStats } from './transcript.js';

const RECENT_MS = 48 * 3600_000;
const LIVE_MS = 90_000;

interface Discovered {
  id: string;
  file: string | null;
  dir: string | null;
  cwd: string | null;
  label: string;
  at: number;
  tracked: boolean;
  todos: Array<{ content?: string; status?: string }>;
}

/** The todo mirror carries three states; the board's model carries five. */
function toStatus(raw: string | undefined): TaskStatus {
  if (raw === 'completed') return 'done';
  if (raw === 'in_progress') return 'in progress';
  if (raw === 'blocked') return 'blocked';
  if (raw === 'cancelled') return 'cancelled';
  return 'todo';
}

function discover(): Discovered[] {
  const found = new Map<string, Discovered>();

  // Sessions with a todo mirror carry task state and a working directory.
  try {
    for (const name of fs.readdirSync(GUARD)) {
      if (!name.endsWith('.meta.json')) continue;
      const id = name.replace('.meta.json', '');
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(GUARD, name), 'utf8'));
        found.set(id, {
          id,
          file: null,
          dir: null,
          cwd: meta.cwd ?? null,
          label: labelFromCwd(meta.cwd) ?? id.slice(0, 8),
          at: meta.updated ? Date.parse(meta.updated) : fs.statSync(path.join(GUARD, name)).mtimeMs,
          tracked: true,
          todos: Array.isArray(meta.todos) ? meta.todos : [],
        });
      } catch {
        // A half-written mirror is skipped rather than failing the whole list.
      }
    }
  } catch {
    // No guard directory yet.
  }

  // Recent transcripts catch sessions that never tracked a task, and supply titles.
  // Subagent logs live in a nested subagents/ directory and are not sessions.
  try {
    for (const slug of fs.readdirSync(PROJECTS)) {
      const dir = path.join(PROJECTS, slug);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
        const id = entry.name.replace('.jsonl', '');
        const file = path.join(dir, entry.name);
        const at = fs.statSync(file).mtimeMs;
        if (Date.now() - at > RECENT_MS) continue;

        const existing = found.get(id);
        if (existing) {
          existing.file = file;
          existing.dir = dir;
          existing.at = Math.max(existing.at, at);
        } else {
          found.set(id, {
            id,
            file,
            dir,
            cwd: null,
            label: labelFromSlug(slug),
            at,
            tracked: false,
            todos: [],
          });
        }
      }
    }
  } catch {
    // No projects directory — nothing to discover.
  }

  return [...found.values()].sort((a, b) => b.at - a.at);
}

function summarise(d: Discovered, stats: TranscriptStats | null): SessionSummary {
  const [project = d.label, worktree = null] = d.label.split(' · ');
  // A rename wins over the generated title; clearing it falls back automatically.
  const custom = readTitles()[d.id];
  const tasks = d.todos.map((t) => toStatus(t.status));
  return {
    id: d.id,
    title: custom ?? stats?.title ?? null,
    titleIsCustom: Boolean(custom),
    project,
    worktree,
    live: Date.now() - d.at < LIVE_MS,
    at: d.at,
    started: stats?.first ?? null,
    tracked: d.tracked,
    tasks: {
      total: tasks.length,
      done: tasks.filter((s) => s === 'done').length,
      active: tasks.filter((s) => s === 'in progress').length,
      blocked: tasks.filter((s) => s === 'blocked').length,
    },
  };
}

/** Cancelled work counts as neither done nor outstanding. */
function countTasks(features: Feature[]): SessionSummary['tasks'] {
  const tasks = features.flatMap((f) => f.tasks);
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    active: tasks.filter((t) => t.status === 'in progress').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  };
}

export function boardState(): BoardState {
  const sessions = discover().map((d) => {
    const stats = d.file ? readTranscript(d.id, d.file) : null;
    const summary = summarise(d, stats);
    // The list and the detail have to agree. When a session authors features, both
    // count from those rather than one counting the flat mirror behind the other's back.
    const features = readFeatures(d.id, d, stats);
    if (features.length) summary.tasks = countTasks(features);
    return summary;
  });

  const projects: ProjectSummary[] = [];
  for (const s of sessions) {
    let p = projects.find((x) => x.name === s.project);
    if (!p) projects.push((p = { name: s.project, count: 0, live: 0, open: 0 }));
    p.count++;
    if (s.live) p.live++;
    p.open += s.tasks.total - s.tasks.done;
  }

  return { sessions, projects };
}

/**
 * Features are authored state the todo mirror does not carry yet. When a session
 * records them in its scratchpad they are used verbatim; otherwise every task
 * lands in one implicit feature so the shape stays the same either way.
 */
function readFeatures(id: string, d: Discovered, stats: TranscriptStats | null): Feature[] {
  const scratch = findScratchpad(id);
  if (scratch) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(scratch, 'session-features.json'), 'utf8'));
      if (Array.isArray(parsed) && parsed.length) {
        // Authored features carry titles and estimates; time spent is still measured
        // from the transcript wherever a task's title matches one that was tracked,
        // so nobody has to record a duration by hand.
        return (parsed as Feature[]).map((feature) => ({
          ...feature,
          tasks: feature.tasks.map((task) => ({
            ...task,
            spent: task.spent ?? spentMinutes(stats?.taskTimes.get(task.title)),
          })),
        }));
      }
    } catch {
      // No authored features — fall through to the implicit one.
    }
  }

  const tasks: Task[] = d.todos.map((t) => {
    const title = t.content ?? '';
    return {
      title,
      status: toStatus(t.status),
      spent: spentMinutes(stats?.taskTimes.get(title)),
    };
  });

  return tasks.length ? [{ name: 'Session tasks', tasks }] : [];
}

function readDecisions(id: string): Decision[] {
  const scratch = findScratchpad(id);
  if (!scratch) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(scratch, 'session-decisions.json'), 'utf8'));
    if (Array.isArray(parsed)) return parsed as Decision[];
  } catch {
    // Fall back to the older one-line markdown log.
  }
  try {
    return fs
      .readFileSync(path.join(scratch, 'session-status.md'), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l, i) => ({ id: i + 1, status: 'decided' as const, decided: l.slice(2).trim() }));
  } catch {
    return [];
  }
}

export function sessionDetail(id: string): SessionDetail | null {
  const d = discover().find((s) => s.id === id);
  if (!d) return null;

  const stats = d.file ? readTranscript(d.id, d.file) : null;
  const summary = summarise(d, stats);
  const subagents = d.dir ? readSubagents(d.dir, id) : [];
  const repo = d.cwd ?? '';

  return {
    ...summary,
    cwd: d.cwd,
    model: stats?.model ?? null,
    turns: { user: stats?.users ?? 0, assistant: stats?.assistants ?? 0 },
    toolCalls: stats?.toolCalls ?? 0,
    subagentCount: subagents.length,
    features: readFeatures(id, d, stats),
    prompts: stats?.prompts ?? [],
    git: readGit(d.cwd),
    decisions: readDecisions(id),
    activity: stats
      ? {
          tokens: stats.tokens,
          effort: stats.effort,
          tools: stats.tools,
          files: stats.files.map((f) => ({
            path: f.path,
            at: f.at,
            // Tracking paths are recorded relative to the session's directory when the
            // file is inside it, and absolute when it is not — so a relative path is
            // inside the repository by construction.
            inRepo: !path.isAbsolute(f.path)
              ? true
              : Boolean(repo) && f.path.toLowerCase().startsWith(repo.toLowerCase()),
          })),
          subagents,
          hooks: stats.hooks,
          skills: stats.skills,
          queue: stats.queue,
          timeline: stats.timeline,
        }
      : null,
  };
}

export const CLAUDE_HOME = CLAUDE;
