import { router, serve, type ResourceDefinition, type Source } from '@bh/source';
import type { Id } from '@bh/resource';
import { resourceClient, type ResourceClient } from '@bh/resource/client';

// The server the tests talk to: @bh/source's router over two resources it
// serves in memory (a source with paging 'none'), tasks and the users a task
// is owned by, reached through a fetch that hands each request to the router
// as a server's handler would. Every request it was sent is kept, so a test
// tells a list placed by the client from one asked for again.

export interface Task {
  id: number;
  title: string;
  status: string;
  points: number | null;
  owner: number | null;
}

const statuses = [
  { value: 'todo', label: 'To do', order: 0, attributes: { kind: 'open' } },
  { value: 'doing', label: 'Doing', order: 1, attributes: { kind: 'open' } },
  { value: 'done', label: 'Done', order: 2, attributes: { kind: 'closed' } },
];

export const tasksDefinition: ResourceDefinition = {
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
          options: statuses,
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
    { key: 'points', label: 'Points', type: { kind: 'number' } },
    { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'users' } } },
  ],
  sort: [{ field: 'status', dir: 'asc' }],
};

const usersDefinition: ResourceDefinition = {
  resource: 'users',
  label: { one: 'User', other: 'Users' },
  roles: { idField: 'id', titleField: 'name' },
  fields: [
    { key: 'id', label: 'Id', type: { kind: 'number', settings: { integer: true } } },
    { key: 'name', label: 'Name', type: { kind: 'text' } },
  ],
  sort: [{ field: 'name', dir: 'asc' }],
};

export function tasksOf(): Task[] {
  return [
    { id: 1, title: 'Fix the login', status: 'todo', points: 3, owner: 7 },
    { id: 2, title: 'Write the docs', status: 'doing', points: 1, owner: null },
    { id: 3, title: 'Ship it', status: 'done', points: 5, owner: 8 },
    { id: 4, title: 'Fix the cache', status: 'todo', points: 2, owner: 7 },
    { id: 5, title: 'Drop IE', status: 'todo', points: 8, owner: 8 },
  ];
}

/** The tasks as a source answering every row at once, and writing to the list. */
function tasksSource(file: Task[]): Source<Task, never, Task[], Partial<Task>> {
  const find = (id: Id) => file.find((task) => task.id === id) ?? null;
  const to = (key: keyof Task) => (value: unknown) => ({ [key]: value }) as Partial<Task>;
  return {
    row: {
      id: (task) => task.id,
      title: (task) => task.title,
      status: (task) => task.status,
      points: (task) => task.points,
      owner: (task) => task.owner,
    },
    query: { paging: 'none', run: () => Promise.resolve(file), records: (answer) => answer },
    read: { run: (id) => Promise.resolve(find(id)) },
    create: {
      fields: {
        title: { required: true, to: to('title') },
        status: { default: 'todo', to: to('status') },
        points: { to: to('points') },
        owner: { to: to('owner') },
      },
      run: (body) => {
        const task: Task = {
          id: Math.max(0, ...file.map((each) => each.id)) + 1,
          title: '',
          status: 'todo',
          points: null,
          owner: null,
          ...body,
        };
        file.push(task);
        return Promise.resolve(task);
      },
    },
    update: {
      fields: {
        title: { required: true, to: to('title') },
        status: { to: to('status') },
        points: { to: to('points') },
        owner: { to: to('owner') },
      },
      run: (id, body) => {
        const task = find(id);
        if (task) {
          Object.assign(task, body);
        }
        return Promise.resolve(task);
      },
    },
    delete: {
      run: (id) => {
        const at = file.findIndex((task) => task.id === id);
        if (at !== -1) {
          file.splice(at, 1);
        }
        return Promise.resolve(at !== -1);
      },
    },
  };
}

const people = [
  { id: 7, name: 'Ada' },
  { id: 8, name: 'Bob' },
];

const usersSource: Source<{ id: number; name: string }, never, typeof people> = {
  row: { id: (user) => user.id, name: (user) => user.name },
  query: { paging: 'none', run: () => Promise.resolve(people), records: (answer) => answer },
};

/** A request as the server got it. */
export interface Received {
  method: string;
  path: string;
  body: unknown;
  idempotencyKey: string | null;
}

/**
 * A server over a fresh copy of the tasks, and a client that talks to it.
 * `viewer` is who every request is signed in as, as an app's auth would say.
 */
export function testServer(viewer?: number, file: Task[] = tasksOf()) {
  const route = router([
    serve(tasksDefinition, tasksSource(file)),
    serve(usersDefinition, usersSource),
  ]);
  const received: Received[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input), 'http://tasks.test');
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const method = init.method ?? 'GET';
    received.push({
      method,
      path: url.pathname,
      body,
      idempotencyKey: new Headers(init.headers).get('idempotency-key'),
    });
    const answer = await route({
      method,
      path: url.pathname.replace(/^\/api/, ''),
      query: Object.fromEntries(url.searchParams),
      body,
      ctx: viewer === undefined ? {} : { viewer },
    });
    return answer.body === undefined
      ? new Response(null, { status: answer.status })
      : Response.json(answer.body, { status: answer.status });
  };
  const client: ResourceClient = resourceClient({ base: '/api', fetch });
  /** The requests of one kind the server got: 'POST /api/tasks/query'. */
  const asked = (what: string) => {
    return received.filter((each) => `${each.method} ${each.path}` === what).length;
  };
  return { file, fetch, client, received, asked };
}
