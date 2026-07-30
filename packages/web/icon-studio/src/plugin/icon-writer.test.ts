import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DEFAULT_DOC } from '../doc';
import { iconWriter, isLoopback } from './icon-writer';

test('the plugin only exists while serving', () => {
  const plugin = iconWriter({ repoRoot: '/repo' });
  expect(plugin.name).toBe('icon-writer');
  expect(plugin.apply).toBe('serve');
});

test('loopback addresses are allowed', () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']) {
    expect(isLoopback(addr), addr).toBe(true);
  }
});

test('anything else is refused, including an absent address', () => {
  for (const addr of ['192.168.1.20', '10.0.0.4', '203.0.113.9', undefined]) {
    expect(isLoopback(addr), String(addr)).toBe(false);
  }
});

// --- middleware harness -----------------------------------------------
//
// Below is a minimal req/res pair rather than a real dev server: enough
// surface for the handler (`req.url`, `req.method`, `req.socket.remoteAddress`,
// `res.statusCode`/`setHeader`/`end`) without paying for an actual listening
// socket.

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>;

/** Runs the plugin's `configureServer` hook against a fake server just to capture the one middleware it registers. */
function captureMiddleware(plugin: Plugin): Middleware {
  const hook = plugin.configureServer;
  if (typeof hook !== 'function') {
    throw new Error('expected configureServer to be a plain function, not an object hook');
  }
  let captured: Middleware | undefined;
  const fakeServer = {
    middlewares: {
      use(fn: Middleware) {
        captured = fn;
      },
    },
  };
  // Cast away the hook's declared `this` (a full Rollup/Vite plugin
  // context) — icon-writer's own configureServer body never references
  // `this`, so a plain call with just the server argument is all this needs.
  const call = hook as unknown as (server: unknown) => void;
  call(fakeServer);
  if (!captured) throw new Error('the plugin never registered a middleware');
  return captured;
}

function fakeRequest(
  url: string,
  method: string,
  opts: { remoteAddress?: string; headers?: Record<string, string>; body?: string } = {},
): IncomingMessage {
  const { remoteAddress = '127.0.0.1', headers = {}, body } = opts;
  // Body chunks feed `readBody`'s `for await (const chunk of req)` loop, so
  // the fake needs to be async-iterable, not just carry a `.body` field.
  const chunks = body === undefined ? [] : [Buffer.from(body, 'utf8')];
  return {
    url,
    method,
    headers,
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as IncomingMessage;
}

interface CapturedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function fakeResponse(): { res: ServerResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, headers: {}, body: '' };
  const res = {
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    end(chunk: string) {
      captured.body = chunk;
    },
  };
  // `statusCode` is a plain settable property on the real ServerResponse, so
  // mirror that rather than a getter/setter pair.
  Object.defineProperty(res, 'statusCode', {
    get: () => captured.statusCode,
    set: (value: number) => {
      captured.statusCode = value;
    },
  });
  return { res: res as unknown as ServerResponse, captured };
}

async function withTempRepo(run: (repoRoot: string) => Promise<void>): Promise<void> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'icon-studio-'));
  try {
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

test('a missing config file still yields the locked defaults', async () => {
  await withTempRepo(async (repoRoot) => {
    const middleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res, captured } = fakeResponse();

    await middleware(fakeRequest('/__icons/config', 'GET'), res, () => {});

    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual(DEFAULT_DOC);
  });
});

test('a config file with invalid JSON yields an error, never the defaults', async () => {
  await withTempRepo(async (repoRoot) => {
    const configPath = path.join(repoRoot, 'apps', 'web', 'icons.config.json');
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, '{ this is not json', 'utf8');

    const middleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res, captured } = fakeResponse();

    await middleware(fakeRequest('/__icons/config', 'GET'), res, () => {});

    expect(captured.statusCode).toBe(500);
    const payload = JSON.parse(captured.body);
    expect(payload).not.toEqual(DEFAULT_DOC);
    expect(payload.error).toContain('icons.config.json');
  });
});

// --- content-type gate (a cross-origin form cannot set this header without
// triggering a preflight, which the POST-only check above already refuses) --

test('a non-JSON content-type on generate is refused with 415, and nothing is written', async () => {
  await withTempRepo(async (repoRoot) => {
    const middleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res, captured } = fakeResponse();

    // A `<form enctype="text/plain">` submit produces exactly this shape: a
    // simple request, non-JSON content-type, and (not shown here) a body
    // that a `name=value` split would coincidentally parse as JSON.
    const body = JSON.stringify({ config: DEFAULT_DOC, pngs: {} });
    await middleware(
      fakeRequest('/__icons/generate', 'POST', { headers: { 'content-type': 'text/plain' }, body }),
      res,
      () => {},
    );

    expect(captured.statusCode).toBe(415);
    expect(await readdir(repoRoot)).toEqual([]);
  });
});

test('an application/json content-type on generate proceeds past the content-type check', async () => {
  await withTempRepo(async (repoRoot) => {
    const middleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res, captured } = fakeResponse();

    const body = JSON.stringify({ config: DEFAULT_DOC, pngs: {} });
    await middleware(
      fakeRequest('/__icons/generate', 'POST', { headers: { 'content-type': 'application/json' }, body }),
      res,
      () => {},
    );

    // Must not be turned away at the content-type gate — whatever runGenerate
    // itself decides (200, with a per-file report) is a separate concern.
    expect(captured.statusCode).not.toBe(415);
    expect(captured.statusCode).toBe(200);
  });
});

// --- loopback + method gates, proven rather than merely unit-tested in
// isolation: these run the actual middleware, so deleting either guard makes
// the corresponding test below fail (see the mutation evidence in the final
// fix-wave report). ---

test('a non-loopback remote address is refused with 403 on both routes, and nothing is written', async () => {
  await withTempRepo(async (repoRoot) => {
    const configMiddleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res: configRes, captured: configCaptured } = fakeResponse();
    await configMiddleware(fakeRequest('/__icons/config', 'GET', { remoteAddress: '192.168.1.20' }), configRes, () => {});

    const generateMiddleware = captureMiddleware(iconWriter({ repoRoot }));
    const { res: generateRes, captured: generateCaptured } = fakeResponse();
    const body = JSON.stringify({ config: DEFAULT_DOC, pngs: {} });
    await generateMiddleware(
      fakeRequest('/__icons/generate', 'POST', {
        remoteAddress: '192.168.1.20',
        headers: { 'content-type': 'application/json' },
        body,
      }),
      generateRes,
      () => {},
    );

    expect(configCaptured.statusCode).toBe(403);
    expect(generateCaptured.statusCode).toBe(403);
    expect(await readdir(repoRoot)).toEqual([]);
  });
});

test('GET on generate and POST on config are both refused with 405', async () => {
  await withTempRepo(async (repoRoot) => {
    const middleware = captureMiddleware(iconWriter({ repoRoot }));

    const { res: generateRes, captured: generateCaptured } = fakeResponse();
    await middleware(fakeRequest('/__icons/generate', 'GET'), generateRes, () => {});
    expect(generateCaptured.statusCode).toBe(405);

    const { res: configRes, captured: configCaptured } = fakeResponse();
    await middleware(fakeRequest('/__icons/config', 'POST'), configRes, () => {});
    expect(configCaptured.statusCode).toBe(405);

    expect(await readdir(repoRoot)).toEqual([]);
  });
});
