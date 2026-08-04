import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Everything the board reads lives under the Claude Code home and the per-session
// scratchpad. Nothing here writes.

export const HOME = os.homedir();
export const CLAUDE = path.join(HOME, '.claude');
export const PROJECTS = path.join(CLAUDE, 'projects');
export const GUARD = path.join(CLAUDE, '.session-guard');
export const TEMP = path.join(HOME, 'AppData', 'Local', 'Temp', 'claude');

/** A worktree session belongs to its parent repository, not beside it. */
export function labelFromCwd(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  const w = parts.indexOf('worktrees');
  const last = parts[parts.length - 1] ?? '';
  return w > 1 ? `${parts[w - 2]} · ${last}` : last;
}

/** Transcript directories are named after the cwd: C--Users-me-Projects-tickets */
export function labelFromSlug(slug: string): string {
  const m = slug.split('-Projects-');
  const tail = (m.length > 1 ? m[m.length - 1] : slug.split('-').pop()) ?? slug;
  const w = tail.split('--claude-worktrees-');
  return w.length > 1 ? `${w[0]} · ${w[1]}` : tail;
}

/**
 * The scratchpad path embeds a slugified cwd, which is fragile to reconstruct.
 * Session ids are unique, so glob on the id instead.
 */
export function findScratchpad(sessionId: string): string | null {
  try {
    for (const project of fs.readdirSync(TEMP)) {
      const candidate = path.join(TEMP, project, sessionId, 'scratchpad');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // No temp root yet — no scratchpads to find.
  }
  return null;
}
