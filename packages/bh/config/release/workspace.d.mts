// Types for workspace.mjs, for TypeScript readers such as @bh/shell/vite.

export interface Unit {
  name: string;
  short: string;
  dir: string;
  version: string;
  service: boolean;
  vendored: boolean;
  deps: string[];
}

export function workspaceGlobs(yaml: string): string[];
export function matches(glob: string, dir: string): boolean;
export function shortName(name: string): string;
export function readWorkspace(root: string): {
  name: string;
  services: string[];
  vendored: string[];
  units: Unit[];
};
export function usesOf(unit: Unit, units: Unit[]): Set<string>;
export function unitOfFile(file: string, units: Unit[]): Unit | null;
