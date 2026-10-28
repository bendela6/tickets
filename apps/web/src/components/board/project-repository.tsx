import type { Project } from '../../api/types';
import { repositoryLink } from '../../utils/repository-link';
import { Button, cn, Icon, TextLink, Tooltip, useCopy } from '@tilewise/ui';

// The project's repository on its page, under its name: a web link (GitHub's,
// say) opens in a new tab; an ssh or git@host:path link shows as text with a
// Copy button, since a browser can't open it. Nothing shows when the project
// names no repository; the branch shows only when one is set, since none means
// the remote's own default.
export function ProjectRepository({ project, className }: { project: Project; className?: string }) {
  const { copy, copied, failed } = useCopy();
  if (project.repositoryUrl === null) return null;
  const link = repositoryLink(project.repositoryUrl);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-8 font-mono text-12/17 text-gray-9', className)}>
      {link.kind === 'web' ? (
        <Tooltip content="Open the repository in a new tab">
          <TextLink
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-5"
          >
            <Icon name="link" size="sm" />
            <span className="truncate">{link.label}</span>
            <Icon name="arrow-up-right" size="xs" />
          </TextLink>
        </Tooltip>
      ) : (
        <>
          <span className="inline-flex min-w-0 items-center gap-5 text-gray-11">
            <Icon name="link" size="sm" />
            <span className="truncate select-all">{link.text}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
            onClick={() => void copy(link.text)}
            className="shrink-0"
          >
            <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} size="xs" />
            {copied ? 'Copied' : failed ? 'Could not copy' : 'Copy link'}
          </Button>
        </>
      )}
      {project.defaultBranch ? (
        <span className="shrink-0 rounded-4 bg-surface-inset px-5 py-2 text-11 text-gray-11">
          <span className="sr-only">default branch </span>
          {project.defaultBranch}
        </span>
      ) : null}
    </span>
  );
}
