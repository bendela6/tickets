// Resolves which source file(s) the Implementation tab should show for a demo.
//
// Demo paths are `import.meta.glob` keys — relative specifiers as written in
// the glob pattern (`../pill.demo.tsx`, `../ui/button.demo.tsx`) — and the
// component-source glob keys live in the same space. So resolution is plain
// string path math against those keys, with no filesystem and no bundler
// involvement: join the demo's directory with the declared relative path and
// normalize the `.`/`..` segments away.

function dirname(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

// Leading `..` segments are preserved (they're meaningful — glob keys are
// relative to the globbing module, not to a root), which is why this can't
// just be a `split`/`filter`.
export function joinPath(dir: string, rel: string): string {
  const out: string[] = [];
  for (const segment of [...dir.split('/'), ...rel.split('/')]) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..' && out.length > 0 && out[out.length - 1] !== '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

export function implPaths(demoPath: string, impl?: string | string[]): string[] {
  if (impl === undefined) return [demoPath.replace(/\.demo\.(tsx?)$/, '.$1')];
  const declared = Array.isArray(impl) ? impl : [impl];
  return declared.map((rel) => joinPath(dirname(demoPath), rel));
}

export function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}
