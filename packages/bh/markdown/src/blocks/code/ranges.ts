/** `"3"`, `"3-7"`, `"3,9-11"`: the line numbers named. Anything unreadable is skipped. */
export function parseRanges(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of (spec ?? '').split(',')) {
    const text = part.trim();
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(text);
    if (range) {
      for (let line = Number(range[1]); line <= Number(range[2]); line++) {
        out.add(line);
      }
    } else if (/^\d+$/.test(text)) {
      out.add(Number(text));
    }
  }
  return out;
}
