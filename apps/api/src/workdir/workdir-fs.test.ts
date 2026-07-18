import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../environment';
import { HttpError } from '../errors';
import { assertWorkdirDir, listRoots, listSubdirs } from './workdir-fs';

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

describe('listSubdirs', () => {
  let root: string;
  let savedRoots: string[];

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'listsubdirs-'));
    await mkdir(join(root, 'alpha'));
    await mkdir(join(root, 'beta'));
    await writeFile(join(root, 'a-file.txt'), 'hi'); // must NOT appear
  });

  beforeEach(() => {
    savedRoots = environment.workdirRoots;
  });

  afterEach(() => {
    environment.workdirRoots = savedRoots;
  });

  it('lists only sub-directories of a path inside a root', async () => {
    environment.workdirRoots = [root];
    const out = await listSubdirs(root);
    expect(out.entries.map((e) => e.name).sort()).toEqual(['alpha', 'beta']);
    expect(out.parent).toBe(dirname(root));
  });

  it('rejects a path outside every configured root with 403', async () => {
    environment.workdirRoots = [join(root, 'alpha')];
    await expect(listSubdirs(root)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a `..` escape that resolves outside the roots with 403', async () => {
    environment.workdirRoots = [join(root, 'alpha')];
    await expect(listSubdirs(join(root, 'alpha', '..', '..'))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for a path that does not exist', async () => {
    environment.workdirRoots = [root];
    await expect(listSubdirs(join(root, 'nope'))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('listRoots', () => {
  let savedRoots: string[];

  beforeEach(() => {
    savedRoots = environment.workdirRoots;
  });

  afterEach(() => {
    environment.workdirRoots = savedRoots;
  });

  it('maps configured roots to RootDir rows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'listroots-'));
    environment.workdirRoots = [dir];
    const roots = listRoots();
    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({ path: dir, annotation: dir });
  });
});
