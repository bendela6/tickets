// What a build knows of its repo's versions. @bh/shell/vite makes it at build
// time from the package.json and CHANGELOG.md files; readBuildInfo reads it back.

/** A service of the repo: an app or a server. */
export interface BuildService {
  /** `@tickets/web` */
  name: string;
  /** `apps/web` */
  dir: string;
  version: string;
  /** Its CHANGELOG.md heading for this version, as ISO; empty when unknown. */
  releasedAt: string;
  /** Its version before this release; set when this release changed it. */
  previous?: string;
  /** Its commits in this release. */
  commits?: number;
}

/** A package: the repo's own, or a vendored copy's (bh's). */
export interface BuildPackage {
  /** `@tickets/shared`, `@bh/ui` */
  name: string;
  /** `packages/shared`, `packages/bh/ui` */
  dir: string;
  version: string;
  /** Its CHANGELOG.md heading for this version, as ISO; empty when unknown. */
  releasedAt: string;
  /** Its version before this release; set when this release changed it. */
  previous?: string;
  /** The services that use it, by short name: `['web', 'api']`. */
  usedBy: string[];
}

/** The versions a build was made from. */
export interface BuildInfo {
  stack: {
    /** The repo's name: `tickets`. */
    name: string;
    /** `0.4.1` */
    version: string;
    /** The root CHANGELOG.md heading for this version, as ISO; empty when unknown. */
    releasedAt: string;
    /** The tag on GitHub. */
    url?: string;
  };
  /** The repo on GitHub, `https://github.com/owner/repo`, for commit and changelog links. */
  repository?: string;
  /** Where build.json and releases/ are served: the app's base path, `/`. */
  base: string;
  /** When this build was made, as ISO. */
  builtAt: string;
  /** This page's service: `@tickets/web`. */
  self: string;
  services: BuildService[];
  packages: BuildPackage[];
  /** Set by a dev server: the branch, commits past the stack's tag, uncommitted changes. */
  dev?: { branch: string; ahead: number; dirty: boolean };
}

/** A commit as a release lists it. */
export interface ReleaseCommit {
  /** `fix`; null for a plain note. */
  type: string | null;
  /** The folders it touched, by short name: `['api', 'web']`. */
  scopes: string[];
  breaking: boolean;
  headline: string;
  /** The short hash. */
  hash: string | null;
  bullets: string[];
  /** The `BREAKING CHANGE:` text. */
  change: string | null;
}

/** A stack release, as `releases/index.json` lists it. */
export interface ReleaseSummary {
  version: string;
  /** ISO, with its offset. */
  date: string;
  /** What it versioned. */
  versions: { name: string; version: string }[];
  /** How many commits it lists. */
  commits: number;
}

/** A stack release with its commits: `releases/<version>.json`. */
export interface Release extends Omit<ReleaseSummary, 'commits'> {
  /** Newest first. */
  commits: ReleaseCommit[];
}

declare const __BH_BUILD_INFO__: BuildInfo | undefined;

/** The build's versions, as @bh/shell/vite put them in; null in a build without it. */
export function readBuildInfo(): BuildInfo | null {
  return typeof __BH_BUILD_INFO__ === 'undefined' ? null : __BH_BUILD_INFO__;
}

/** `@tickets/web` → `web`. */
export function shortName(name: string): string {
  return name.replace(/^@[^/]+\//, '');
}

/** `v0.4.1`, or `v0.4.1+3` on a dev server 3 commits past the tag. */
export function versionLabel(info: BuildInfo): string {
  const ahead = info.dev && info.dev.ahead > 0 ? `+${info.dev.ahead}` : '';
  return `v${info.stack.version}${ahead}`;
}
