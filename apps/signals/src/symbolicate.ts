import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping';
import type { StackFrame, SymbolicatedFrame } from './types';

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// Artifact "index-8f3a91.js.map" symbolicates frames whose file basename is
// "index-8f3a91.js". Returns null when nothing matched (caller keeps raw only).
export function symbolicateFrames(
  frames: StackFrame[],
  artifacts: { filename: string; content: string }[],
): SymbolicatedFrame[] | null {
  const maps = new Map<string, TraceMap>();
  for (const a of artifacts) {
    try {
      maps.set(a.filename.replace(/\.map$/, ''), new TraceMap(a.content));
    } catch {
      // an unparseable map never blocks ingest
    }
  }
  let any = false;
  const out = frames.map<SymbolicatedFrame>((frame) => {
    const tracer = maps.get(basename(frame.file));
    if (!tracer) return { ...frame };
    const pos = originalPositionFor(tracer, { line: frame.line, column: frame.column });
    if (pos.source === null || pos.line === null) return { ...frame };
    any = true;
    const source = pos.source.replace(/^(\.\.\/)+/, '');
    const content = sourceContentFor(tracer, pos.source);
    const contextLines = content
      ? content.split('\n')
          .map((text, i) => ({ line: i + 1, text }))
          .filter((l) => Math.abs(l.line - pos.line!) <= 2)
      : undefined;
    return {
      functionName: pos.name ?? frame.functionName,
      file: source,
      line: pos.line,
      column: pos.column ?? 0,
      inApp: !source.includes('node_modules'),
      contextLines,
    };
  });
  return any ? out : null;
}
