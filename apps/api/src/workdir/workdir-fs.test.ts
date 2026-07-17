import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { HttpError } from '../errors';
import { assertWorkdirDir } from './workdir-fs';

describe('assertWorkdirDir', () => {
  let dir: string;
  let filePath: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'workdir-fs-test-'));
    filePath = join(dir, 'a-file.txt');
    await writeFile(filePath, 'hi');
  });

  it('resolves for an existing directory', async () => {
    await expect(assertWorkdirDir(dir)).resolves.toBeUndefined();
  });

  it('throws 400 for a path that does not exist', async () => {
    await expect(assertWorkdirDir(join(dir, 'nope-nope'))).rejects.toMatchObject({
      constructor: HttpError,
      statusCode: 400,
    });
  });

  it('throws 400 for a path that exists but is a file', async () => {
    await expect(assertWorkdirDir(filePath)).rejects.toBeInstanceOf(HttpError);
    await expect(assertWorkdirDir(filePath)).rejects.toMatchObject({ statusCode: 400 });
  });
});
