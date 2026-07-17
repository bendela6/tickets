import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// A dispatched agent runs in its OWN git worktree so parallel dispatches on one
// repo can't collide. The manager is an injectable seam: the local impl shells
// out to git; tests use a fake so the orchestration is exercised without
// touching a real repo.
export interface WorktreeSpec {
  repoPath: string; // the workspace's git repo
  branch: string; // new branch for the dispatched run
  path: string; // absolute path for the new worktree dir
}

export interface WorktreeManager {
  create(spec: WorktreeSpec): Promise<{ path: string; branch: string }>;
  remove(path: string): Promise<void>;
}

export function createLocalWorktreeManager(): WorktreeManager {
  return {
    async create(spec) {
      // `-b <branch>` creates the branch off the repo's current HEAD and checks
      // it out into an isolated directory.
      await run('git', ['-C', spec.repoPath, 'worktree', 'add', '-b', spec.branch, spec.path]);
      return { path: spec.path, branch: spec.branch };
    },
    async remove(path) {
      // --force drops the worktree even with untracked/modified files; the branch
      // is left behind on purpose so the dispatched work is inspectable.
      await run('git', ['-C', path, 'worktree', 'remove', '--force', path]).catch(async () => {
        // Fall back to pruning from the parent repo if the dir is already gone.
        await run('git', ['worktree', 'prune']).catch(() => {});
      });
    },
  };
}

// Derive a stable, filesystem-safe worktree branch + path for a dispatched
// session. Pure, so the naming is unit-testable.
export function worktreeName(sessionId: number, itemRef?: string): string {
  const suffix = itemRef ? itemRef.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'run';
  return `agent/${suffix}-s${sessionId}`;
}
