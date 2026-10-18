// One commit as the Version page lists it: its git header, `fix(api,web):` in
// the type's colour then the headline, its hash on the right, and its bullets.

import { cn } from '@bh/ui';
import type { ReleaseCommit } from './build-info';

const TONE: Record<string, string> = {
  feat: 'text-indigo-11',
  fix: 'text-green-11',
  perf: 'text-green-11',
};

/** `fix(api,web)!:`: the commit's header before its headline. */
export function commitHead(commit: ReleaseCommit): string {
  if (commit.type === null) {
    return '';
  }
  const scopes = commit.scopes.length > 0 ? `(${commit.scopes.join(',')})` : '';
  return `${commit.type}${scopes}${commit.breaking ? '!' : ''}:`;
}

/** Props for CommitLine component. */
export interface CommitLineProps {
  commit: ReleaseCommit;
  /** The repo on GitHub, for the hash's link. */
  repository?: string;
}

/** A commit's line, its bullets under it, and what a breaking change asks. */
export function CommitLine({ commit, repository }: CommitLineProps) {
  const head = commitHead(commit);
  const tone = commit.breaking
    ? 'text-orange-11 font-600'
    : (TONE[commit.type ?? ''] ?? 'text-gray-10');
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="text-14 text-gray-12 flex min-w-0 items-baseline justify-between gap-12">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {head ? (
            <span className={cn('text-12 mr-6 font-mono whitespace-nowrap', tone)}>{head}</span>
          ) : null}
          {commit.headline}
        </span>
        {commit.hash ? (
          repository ? (
            <a
              href={`${repository}/commit/${commit.hash}`}
              target="_blank"
              rel="noreferrer"
              className="text-12 text-indigo-11 font-mono whitespace-nowrap hover:underline"
            >
              {commit.hash}
            </a>
          ) : (
            <span className="text-12 text-gray-10 font-mono whitespace-nowrap">{commit.hash}</span>
          )
        ) : null}
      </div>
      {commit.bullets.length > 0 ? (
        <ul className="text-13 text-gray-11 flex list-disc flex-col gap-1 pl-18">
          {commit.bullets.map((bullet) => {
            return <li key={bullet}>{bullet}</li>;
          })}
        </ul>
      ) : null}
      {commit.change ? (
        <p className="text-13 text-orange-11">
          <b className="font-600">What to change:</b> {commit.change}
        </p>
      ) : null}
    </li>
  );
}

/** A list of commits, newest first. */
export function CommitList({
  commits,
  repository,
}: {
  commits: ReleaseCommit[];
  repository?: string;
}) {
  return (
    <ul className="flex flex-col gap-10">
      {commits.map((commit, i) => {
        return (
          <CommitLine
            key={`${commit.hash ?? commit.headline}-${i}`}
            commit={commit}
            repository={repository}
          />
        );
      })}
    </ul>
  );
}
