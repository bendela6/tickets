import { stat } from 'node:fs/promises';
import { HttpError } from '../errors';

// A typo'd workdir path must fail the create/dispatch request, not spawn a
// process that dies a moment later. This is the one filesystem check the
// route does before handing off to the driver; kept here so it can be tested
// against a real temp dir and a bogus path.
export async function assertWorkspaceDir(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch {
    throw new HttpError(400, `workdir path does not exist: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new HttpError(400, `workdir path is not a directory: ${path}`);
  }
}
