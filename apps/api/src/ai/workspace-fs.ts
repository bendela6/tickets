import { stat } from 'node:fs/promises';
import { HttpError } from '../errors';

// A typo'd workspace path must fail the create request, not spawn a process that
// dies a moment later (POST /api/ai/sessions, per the E1 spec). This is the one
// filesystem check the route does before handing off to the supervisor; kept
// here so it can be tested against a real temp dir and a bogus path.
export async function assertWorkspaceDir(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch {
    throw new HttpError(400, `workspace path does not exist: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new HttpError(400, `workspace path is not a directory: ${path}`);
  }
}
