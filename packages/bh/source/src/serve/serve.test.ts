import { describe, expect, it, vi } from 'vitest';
import type { Id, Row } from '@bh/resource';
import { conflict, ResourceError } from '../adapter/errors';
import { router } from './router';
import { serve } from './serve';
import { conformance } from '../testing/conformance';
import type { ResourceDefinition } from '../types/definition';
import type { QueryRequest } from '../types/query';
import type { Source } from '../types/source';

// A source bh serves in memory: a file's worth of tasks, answered at once.

interface Task {
  id: number;
  title: string;
  status: string;
  tags: string[];
  points: number | null;
  due: string | null;
  owner: number | null;
}

const tasks: ResourceDefinition = {
  resource: 'tasks',
  label: { one: 'Task', other: 'Tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    { key: 'id', label: 'Id', type: { kind: 'number', settings: { integer: true } } },
    { key: 'title', label: 'Title', type: { kind: 'text' } },
    {
      key: 'status',
      label: 'Status',
      type: {
        kind: 'option',
        settings: {
          options: [
            { value: 'todo', label: 'To do', order: 0, attributes: { kind: 'open' } },
            { value: 'doing', label: 'Doing', order: 1, attributes: { kind: 'open' } },
            { value: 'done', label: 'Done', order: 2, attributes: { kind: 'closed' } },
            { value: 'dropped', label: 'Dropped', order: 3, archived: true },
          ],
          attributes: [
            {
              key: 'kind',
              label: 'Group',
              kind: 'option',
              options: [
                { value: 'open', label: 'Open', order: 0 },
                { value: 'closed', label: 'Closed', order: 1 },
              ],
            },
          ],
        },
      },
    },
    { key: 'tags', label: 'Tags', type: { kind: 'text', many: true } },
    { key: 'points', label: 'Points', type: { kind: 'number' } },
    { key: 'due', label: 'Due', type: { kind: 'date' } },
    { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'users' } } },
  ],
  sort: [{ field: 'status', dir: 'asc' }],
};

function fileOf(): Task[] {
  return [
    {
      id: 1,
      title: 'Fix the login',
      status: 'todo',
      tags: ['auth'],
      points: 3,
      due: '2026-10-20',
      owner: 7,
    },
    {
      id: 2,
      title: 'Write the docs',
      status: 'doing',
      tags: [],
      points: 1,
      due: null,
      owner: null,
    },
    {
      id: 3,
      title: 'Ship it',
      status: 'done',
      tags: ['release', 'auth'],
      points: 5,
      due: '2026-10-01',
      owner: 8,
    },
    {
      id: 4,
      title: 'Drop IE',
      status: 'dropped',
      tags: ['web'],
      points: null,
      due: null,
      owner: 7,
    },
    {
      id: 5,
      title: 'fix the cache',
      status: 'todo',
      tags: ['web'],
      points: 2,
      due: '2026-11-02',
      owner: 7,
    },
  ];
}

/** The file as a source: every row at once, and writes that change it. */
function fileSource(file: Task[]): Source<Task, never, Task[], Partial<Task>> {
  const find = (id: Id) => file.find((task) => task.id === id) ?? null;
  return {
    row: {
      id: (task) => task.id,
      title: (task) => task.title,
      status: (task) => task.status,
      tags: (task) => task.tags,
      points: (task) => task.points,
      due: (task) => task.due,
      owner: (task) => task.owner,
    },
    query: {
      paging: 'none',
      run: () => Promise.resolve(file),
      records: (answer) => answer,
    },
    read: { run: (id) => Promise.resolve(find(id)) },
    create: {
      fields: {
        title: { required: true, to: (value) => ({ title: value as string }) },
        status: { default: 'todo', to: (value) => ({ status: value as string }) },
        tags: { to: (value) => ({ tags: value as string[] }) },
      },
      check: (values) => {
        const taken = file.some((task) => task.title === values['title']);
        return taken ? [{ path: ['values', 'title'], message: 'a task has that title' }] : [];
      },
      run: (body) => {
        const task: Task = {
          id: file.length + 1,
          title: '',
          status: 'todo',
          tags: [],
          points: null,
          due: null,
          owner: null,
          ...body,
        };
        file.push(task);
        return Promise.resolve(task);
      },
    },
    update: {
      fields: {
        status: { to: (value) => ({ status: value as string }) },
        points: { to: (value) => ({ points: value as number | null }) },
      },
      run: (id, body) => {
        const task = find(id);
        return Promise.resolve(task && Object.assign(task, body));
      },
    },
    delete: {
      run: (id) => {
        const at = file.findIndex((task) => task.id === id);
        return Promise.resolve(at !== -1 && file.splice(at, 1).length === 1);
      },
    },
  };
}

const ids = (rows: readonly Row[]) => rows.map((row) => row['id']);

describe('serve, in memory', () => {
  const served = serve(tasks, fileSource(fileOf()));

  it('makes the metadata from the kinds: everything each allows, and what the source writes', () => {
    const field = (key: string) => served.meta.fields.find((each) => each.key === key);
    expect(field('status')?.query).toEqual({
      filter: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
      sort: true,
      group: true,
      search: false,
    });
    // A list isn't filtered by equals, nor sorted.
    expect(field('tags')?.query.filter).not.toContain('equals');
    expect(field('tags')?.query.sort).toBe(false);
    // A ref orders by its row's title, which only its source knows.
    expect(field('owner')?.query.sort).toBe(false);
    expect(field('owner')?.query.filter).toContain('isMe');
    expect(field('title')?.write).toEqual({ create: true, update: false, required: true });
    expect(field('status')?.write).toEqual({
      create: true,
      update: true,
      required: false,
      default: 'todo',
    });
    expect(served.meta.serves).toEqual({
      read: true,
      create: true,
      update: true,
      delete: true,
      filter: { any: true, not: true },
      sort: { max: 10 },
      page: { numbered: 'any', cursor: true, total: true, max: 500 },
    });
  });

  it('filters by matchesFilter, a path through an option’s attributes too', async () => {
    const open = await served.query({
      filter: { field: 'status.kind', op: 'equals', value: 'open' },
    });
    expect(ids(open.rows)).toEqual([1, 5, 2]);
    const mine = await served.query({ filter: { field: 'owner', op: 'isMe' } }, { viewer: 7 });
    expect(ids(mine.rows)).toEqual([1, 5, 4]);
    const tagged = await served.query({
      filter: { not: { field: 'tags', op: 'in', value: ['auth'] } },
    });
    expect(ids(tagged.rows)).toEqual([5, 2, 4]);
  });

  it('orders by each kind’s rule, those without a value last both ways, the id breaking ties', async () => {
    const byPoints = await served.query({ sort: [{ field: 'points', dir: 'desc' }] });
    expect(ids(byPoints.rows)).toEqual([3, 1, 5, 2, 4]);
    const byTitle = await served.query({ sort: [{ field: 'title', dir: 'asc' }] });
    expect(ids(byTitle.rows)).toEqual([4, 5, 1, 3, 2]);
    const byDue = await served.query({ sort: [{ field: 'due', dir: 'asc' }] });
    expect(ids(byDue.rows)).toEqual([3, 1, 5, 2, 4]);
  });

  it('searches the fields a search looks in, case ignored', async () => {
    const found = await served.query({ search: 'FIX' });
    expect(ids(found.rows)).toEqual([1, 5]);
  });

  it('pages by number and after our cursor, counting every row', async () => {
    const first = await served.query({ page: { take: 2 } });
    expect(ids(first.rows)).toEqual([1, 5]);
    expect(first.page).toMatchObject({ more: true, total: 5 });
    const second = await served.query({ page: { cursor: first.page.next, take: 2 } });
    expect(ids(second.rows)).toEqual([2, 3]);
    const numbered = await served.query({ page: { skip: 2, take: 2 } });
    expect(ids(numbered.rows)).toEqual([2, 3]);
    const last = await served.query({ page: { skip: 4, take: 2 } });
    expect(last.page).toEqual({ next: null, more: false, total: 5 });
  });

  it('refuses another query’s cursor', async () => {
    const first = await served.query({ page: { take: 2 } });
    await expect(
      served.query({ search: 'fix', page: { cursor: first.page.next, take: 2 } }),
    ).rejects.toMatchObject({ code: 'invalid', issues: [{ path: ['page', 'cursor'] }] });
  });

  it('groups, the groups no row holds too, an archived option only while rows hold it', async () => {
    const result = await served.query({ group: { field: 'status', all: true } });
    expect(result.groups?.map(({ key, count }) => [key, count])).toEqual([
      ['todo', 2],
      ['doing', 1],
      ['done', 1],
      ['dropped', 1],
    ]);
    expect(result.groups?.[0]?.filter).toEqual({ field: 'status', op: 'equals', value: 'todo' });
    const owners = await served.query({ group: { field: 'owner' } });
    expect(owners.groups?.map(({ key, count }) => [key, count])).toEqual([
      [7, 3],
      [8, 1],
      [null, 1],
    ]);
    expect(owners.groups?.find((group) => group.key === null)?.filter).toEqual({
      field: 'owner',
      op: 'empty',
    });
  });

  it('answers only the fields a query asks for, and those that name a row', async () => {
    const result = await served.query({ fields: ['due'], page: { take: 1 } });
    expect(result.rows).toEqual([{ id: 1, title: 'Fix the login', due: '2026-10-20' }]);
  });

  it('answers each query as the contract says, by the conformance check', async () => {
    expect(await conformance(served, { ctx: { viewer: 7 } })).toEqual([]);
  });
});

describe('serve, writing', () => {
  it('creates with the defaults, after the operation’s own check', async () => {
    const served = serve(tasks, fileSource(fileOf()));
    const row = await served.create({ values: { title: 'Plan the next one' } });
    expect(row).toMatchObject({ id: 6, title: 'Plan the next one', status: 'todo', tags: [] });
    await expect(served.create({ values: { title: 'Ship it' } })).rejects.toMatchObject({
      code: 'invalid',
      issues: [{ path: ['values', 'title'], message: 'a task has that title' }],
    });
    await expect(served.create({ values: { title: 'X', points: 3 } })).rejects.toMatchObject({
      code: 'invalid',
      issues: [{ path: ['values', 'points'], message: '"points" can\'t be set' }],
    });
  });

  it('patches, reads and deletes, answering not_found for a row there isn’t', async () => {
    const served = serve(tasks, fileSource(fileOf()));
    expect(await served.update(2, { values: { status: 'done' } })).toMatchObject({
      status: 'done',
    });
    expect(await served.read(2)).toMatchObject({ status: 'done' });
    await served.delete(2);
    await expect(served.read(2)).rejects.toMatchObject({ code: 'not_found', status: 404 });
    await expect(served.delete(2)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('serve, checking what a source answers', () => {
  it('answers internal for a row out of shape, and says which field', async () => {
    const log = vi.fn();
    const file = fileOf();
    file.push({ ...file[0], id: 6, status: 'archived' } as Task);
    const served = serve(tasks, fileSource(file), { log });
    await expect(served.query({})).rejects.toMatchObject({ code: 'internal', status: 500 });
    expect(log).toHaveBeenCalledWith('tasks: the source answered a row out of shape', [
      { path: ['status'], message: 'no option "archived"' },
    ]);
  });

  it('passes a source’s own error on as it is, and any other as internal', async () => {
    const log = vi.fn();
    const source = fileSource(fileOf());
    const stale = serve(
      tasks,
      {
        ...source,
        update: { ...source.update, fields: source.update?.fields ?? {}, run: () => conflict() },
      },
      { log },
    );
    await expect(stale.update(1, { values: { status: 'done' } })).rejects.toMatchObject({
      code: 'conflict',
    });
    const broken = serve(
      tasks,
      { ...source, read: { run: () => Promise.reject(new Error('ECONNRESET')) } },
      { log },
    );
    await expect(broken.read(1)).rejects.toMatchObject({
      code: 'internal',
      message: 'the source failed',
    });
    expect(log).toHaveBeenCalledWith('tasks: the source failed', new Error('ECONNRESET'));
  });
});

describe('serve, a source’s declarations', () => {
  it('refuses, all at once, a declaration its kinds and fields don’t allow', () => {
    const source = fileSource(fileOf());
    const wrong: Source<Task, string, Task[], Partial<Task>> = {
      row: { ...source.row, colour: () => 'red' },
      query: {
        filter: {
          fields: {
            points: { contains: () => 'x' },
            tags: { equals: () => 'x' },
            size: { lt: () => 'x' },
          },
          all: (parts) => parts.join(),
        },
        sort: { fields: { tags: () => 'tags' } },
        paging: { max: 100 },
        run: () => Promise.resolve([]),
        records: (answer) => answer,
      },
      update: {
        fields: { title: { to: (value) => ({ title: value as string }) } },
        version: true,
        run: () => Promise.resolve(null),
      },
    };
    expect(() => serve(tasks, wrong)).toThrow(
      [
        'The source can\'t serve "tasks":',
        '  - row.colour: no field "colour"',
        '  - query: no field "size"',
        '  - update: it checks a version, but the resource names no roles.versionField',
        '  - query.filter.fields.tags.equals: a field holding a list isn\'t filtered by "equals"',
        "  - query.sort.fields.tags: a field holding a list can't be sorted",
        '  - query.filter.fields.points.contains: the kind "number" can\'t be filtered by "contains"',
        '  - query.paging: a source pages by offset, by page number or by cursor',
        '  - meta.sort.0.field: "status" can\'t be sorted',
      ].join('\n'),
    );
  });
});

// A source that filters, sorts and pages itself, as an API does: its request
// is the parameters it sends, which the test reads back.

type Params = [string, string][];

function apiSource(seen: Params[]): Source<Task, Params, { tasks: Task[]; next: boolean }, never> {
  const file = fileOf();
  return {
    row: fileSource(file).row,
    query: {
      filter: {
        fields: {
          status: { equals: (value) => [['status', String(value)]] },
          tags: { in: (value) => [['tag', String((value as string[])[0])]] },
        },
        all: (parts) => parts.flat(),
      },
      sort: { fields: { points: (dir) => [['sort', `points.${dir}`]] } },
      paging: {
        max: 2,
        page: (page, size) => {
          return [
            ['page', String(page)],
            ['size', String(size)],
          ];
        },
        more: (answer) => answer.next,
      },
      run: (request: QueryRequest<Params>) => {
        const params = [...(request.filter ?? []), ...request.sort.flat(), ...request.page];
        seen.push(params);
        const page = Number(params.find(([key]) => key === 'page')?.[1]);
        return Promise.resolve({
          tasks: file.slice((page - 1) * 2, page * 2),
          next: page * 2 < file.length,
        });
      },
      records: (answer) => answer.tasks,
    },
  };
}

describe('serve, a source that pages itself', () => {
  it('offers what it declares, and serves what it can', () => {
    const served = serve({ ...tasks, sort: [] }, apiSource([]));
    const field = (key: string) => served.meta.fields.find((each) => each.key === key);
    expect(field('status')?.query).toEqual({
      filter: ['equals'],
      sort: false,
      group: false,
      search: false,
    });
    expect(field('points')?.query.sort).toBe(true);
    expect(served.meta.serves).toMatchObject({
      read: false,
      create: false,
      filter: { any: false, not: false },
      sort: { max: 1 },
      page: { numbered: 'pages', cursor: false, total: false, max: 2 },
    });
  });

  it('hands it its own words: the filter joined, the sort, a page number', async () => {
    const seen: Params[] = [];
    const served = serve({ ...tasks, sort: [] }, apiSource(seen));
    const answer = await served.query({
      filter: {
        all: [
          { field: 'status', op: 'equals', value: 'todo' },
          { field: 'tags', op: 'in', value: ['web'] },
        ],
      },
      sort: [{ field: 'points', dir: 'desc' }],
      page: { skip: 2, take: 2 },
    });
    expect(seen).toEqual([
      [
        ['status', 'todo'],
        ['tag', 'web'],
        ['sort', 'points.desc'],
        ['page', '2'],
        ['size', '2'],
      ],
    ]);
    expect(answer.page).toEqual({ next: null, more: true, total: null });
  });

  it('refuses what it can’t serve before it runs: an any, a skip between pages, a big page', async () => {
    const seen: Params[] = [];
    const served = serve({ ...tasks, sort: [] }, apiSource(seen));
    await expect(
      served.query({ filter: { any: [{ field: 'status', op: 'equals', value: 'todo' }] } }),
    ).rejects.toBeInstanceOf(ResourceError);
    await expect(served.query({ page: { skip: 1, take: 2 } })).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(served.query({ page: { take: 3 } })).rejects.toMatchObject({ code: 'invalid' });
    expect(seen).toEqual([]);
  });
});

describe('router', () => {
  const route = router([serve(tasks, fileSource(fileOf()))]);

  it('answers each route with its status, and an error in ErrorBody’s shape', async () => {
    expect(await route({ method: 'GET', path: '/tasks/meta' })).toMatchObject({ status: 200 });
    expect(
      await route({ method: 'POST', path: '/tasks/query', body: { page: { take: 1 } } }),
    ).toMatchObject({
      status: 200,
      body: { rows: [{ id: 1 }] },
    });
    expect(await route({ method: 'GET', path: '/tasks/3' })).toMatchObject({
      status: 200,
      body: { id: 3 },
    });
    expect(
      await route({ method: 'POST', path: '/tasks', body: { values: { title: 'New' } } }),
    ).toMatchObject({
      status: 201,
    });
    expect(
      await route({ method: 'PATCH', path: '/tasks/3', body: { values: { points: 8 } } }),
    ).toMatchObject({
      status: 200,
      body: { points: 8 },
    });
    expect(await route({ method: 'DELETE', path: '/tasks/3' })).toEqual({ status: 204 });
    expect(await route({ method: 'GET', path: '/tasks/3' })).toEqual({
      status: 404,
      body: { error: { code: 'not_found', message: 'there is no such row' } },
    });
    expect(await route({ method: 'GET', path: '/tasks/x' })).toMatchObject({ status: 400 });
    expect(await route({ method: 'GET', path: '/nothing/meta' })).toMatchObject({ status: 404 });
  });
});
