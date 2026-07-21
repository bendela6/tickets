import * as v from 'valibot';

const StackFrameSchema = v.object({
  functionName: v.string(),
  file: v.string(),
  line: v.number(),
  column: v.number(),
  inApp: v.boolean(),
});

const BreadcrumbSchema = v.object({
  type: v.picklist(['console', 'click', 'navigation', 'http', 'custom']),
  timestamp: v.string(),
  message: v.optional(v.string()),
  data: v.optional(v.record(v.string(), v.unknown())),
});

export const IngestSignalSchema = v.object({
  kind: v.picklist(['error', 'log', 'event']),
  sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
  message: v.optional(v.pipe(v.string(), v.maxLength(5000))),
  mechanism: v.picklist([
    'uncaught-exception', 'unhandled-rejection', 'error-boundary', 'middleware', 'console', 'manual',
  ]),
  level: v.picklist(['error', 'warning', 'info']),
  timestamp: v.pipe(v.string(), v.isoTimestamp()),
  release: v.optional(v.pipe(v.string(), v.maxLength(100))),
  environment: v.optional(v.pipe(v.string(), v.maxLength(50))),
  fingerprint: v.optional(v.pipe(v.string(), v.maxLength(200))),
  stack: v.optional(v.array(StackFrameSchema)),
  breadcrumbs: v.optional(v.array(BreadcrumbSchema)),
  user: v.optional(v.object({
    id: v.optional(v.string()), email: v.optional(v.string()), name: v.optional(v.string()),
  })),
  tags: v.optional(v.record(v.string(), v.string())),
  contexts: v.optional(v.record(v.string(), v.record(v.string(), v.unknown()))),
  platform: v.object({
    runtime: v.picklist(['browser', 'node']),
    os: v.optional(v.string()),
    browser: v.optional(v.string()),
    url: v.optional(v.string()),
    nodeVersion: v.optional(v.string()),
    hostname: v.optional(v.string()),
    pid: v.optional(v.number()),
  }),
  sdk: v.object({ name: v.string(), version: v.string() }),
});

export const IngestEnvelopeSchema = v.object({
  signals: v.pipe(v.array(IngestSignalSchema), v.minLength(1), v.maxLength(64)),
});

export type IngestSignal = v.InferOutput<typeof IngestSignalSchema>;
