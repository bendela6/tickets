#!/usr/bin/env node
// Signals — Node SDK example.
//
// Usage:
//   npm install @bendela6/signals-node
//   node node-demo.mjs "sgl://<ingestKey>@127.0.0.1:4640/<appId>"
//
// (DSN can also come from an env var — swap the argv line below for your
// preferred config source.)

import { initSignals } from '@bendela6/signals-node';

const dsn = process.argv[2];
if (!dsn) {
  console.error('usage: node node-demo.mjs <dsn>');
  process.exit(1);
}

const client = initSignals({
  dsn,
  release: '1.0.0',
  environment: 'development',
  // This demo drives capture + flush explicitly and exits on its own terms;
  // it doesn't need the SDK's uncaughtException/unhandledRejection listeners.
  registerProcessHandlers: false,
});

client.setTag('example', 'node-demo');

client.captureEvent('demo-started', { pid: process.pid });

try {
  JSON.parse('{ not valid json');
} catch (error) {
  client.captureError(error);
}

console.log(`sent 1 event + 1 error for session ${client.sessionId}, flushing…`);
await client.flush();
console.log('done — check the Signals UI for a new issue.');
