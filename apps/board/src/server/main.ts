import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardState, sessionDetail } from './store.js';
import { setTitle } from './titles.js';

// A read-only local API over the Claude Code home. It never writes, and it binds to
// loopback only — the data it exposes is every transcript on the machine.

const PORT = Number(process.env.BOARD_PORT ?? 4680);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function json(res: http.ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** Serve the built client when it exists; in dev, Vite owns this and proxies /api here. */
function serveStatic(url: string, res: http.ServerResponse): void {
  if (!fs.existsSync(DIST)) {
    json(res, { error: 'client not built — run vite dev, or pnpm build' }, 404);
    return;
  }
  const rel = url === '/' ? 'index.html' : url.slice(1);
  const file = path.join(DIST, rel);
  // Keep path traversal out of a server that can read the whole home directory.
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { 'content-type': MIME['.html'] as string });
    res.end(fs.readFileSync(path.join(DIST, 'index.html')));
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/state') {
    json(res, boardState());
    return;
  }

  // The only write the board performs. It stores a rename in the board's own file
  // and never touches the transcript that produced the generated title.
  const rename = url.pathname.match(/^\/api\/session\/([\w-]+)\/title$/);
  if (rename && req.method === 'PATCH') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // A rename is a short string; anything larger is not one.
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      try {
        const { title } = JSON.parse(body || '{}');
        if (typeof title !== 'string') {
          json(res, { error: 'title must be a string' }, 400);
          return;
        }
        json(res, { title: setTitle(rename[1] as string, title) });
      } catch {
        json(res, { error: 'invalid body' }, 400);
      }
    });
    return;
  }

  const match = url.pathname.match(/^\/api\/session\/([\w-]+)$/);
  if (match) {
    const detail = sessionDetail(match[1] as string);
    if (!detail) {
      json(res, { error: 'unknown session' }, 404);
      return;
    }
    json(res, detail);
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    json(res, { error: 'not found' }, 404);
    return;
  }

  serveStatic(url.pathname, res);
});

// Starting twice is not an error — it means the board is already up.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`board api already running → http://localhost:${PORT}`);
    process.exit(0);
  }
  console.error(err.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`board api → http://localhost:${PORT}`);
});
