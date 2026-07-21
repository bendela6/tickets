import type { StackFrame } from './types';

const V8_FRAME = /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO_FRAME = /^\s*(?:(.*?)@)?(.+?):(\d+):(\d+)\s*$/;

const defaultIsInApp = (file: string): boolean => !/node_modules|^node:/.test(file);

export function parseStack(
  stack: string | undefined,
  isInApp: (file: string) => boolean = defaultIsInApp,
): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const match = V8_FRAME.exec(line) ?? (line.includes('@') ? GECKO_FRAME.exec(line) : null);
    if (!match) continue;
    const [, fn, file, ln, col] = match;
    if (!file || file.includes(' ')) continue; // "just a message" guard
    frames.push({
      functionName: fn?.trim() || '<anonymous>',
      file,
      line: Number(ln),
      column: Number(col),
      inApp: isInApp(file),
    });
  }
  return frames;
}
