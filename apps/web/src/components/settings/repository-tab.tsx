import { useState } from 'react';
import { OWN_ERROR } from '../../api/mutation-meta';
import { fieldIssues } from '../../api/field-issues';
import { useUpdateProject } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, Card, FieldError, FieldLabel, Input } from '@tilewise/ui';
import { DisabledReason } from '../disabled-reason';
import type { SettingsTabProps } from './types-tab';

const FIELDS = ['repositoryUrl', 'defaultBranch'] as const;
type FieldName = (typeof FIELDS)[number];

type Draft = { url: string; branch: string };

// What the form sends for a draft. With no link there is no branch to keep: the
// API clears it with the link, and the branch field is off meanwhile.
function toInput(draft: Draft) {
  const url = draft.url.trim();
  const branch = draft.branch.trim();
  return { repositoryUrl: url === '' ? null : url, defaultBranch: url === '' || branch === '' ? null : branch };
}

// The project's repository: the git link everyone clones and the branch work
// lands on. Only the link is kept by tickets: where each developer has the
// repository checked out is set on their own machine. The API is what checks
// both values; a refusal comes back as `field: message` and shows at its field.
export function RepositoryTab({ board }: SettingsTabProps) {
  const { project } = board;
  const { userId } = useCurrentUser();
  const disabled = userId === null;
  const updateProject = useUpdateProject(OWN_ERROR);
  const [draft, setDraft] = useState<Draft>({ url: project.repositoryUrl ?? '', branch: project.defaultBranch ?? '' });
  const [issues, setIssues] = useState<{ byField: Partial<Record<FieldName, string>>; rest: string | null }>({
    byField: {},
    rest: null,
  });
  const [saved, setSaved] = useState(false);

  const input = toInput(draft);
  const dirty = input.repositoryUrl !== project.repositoryUrl || input.defaultBranch !== project.defaultBranch;
  const noLink = draft.url.trim() === '';

  function edit(next: Draft, field: FieldName) {
    setDraft(next);
    setSaved(false);
    // An edited field's message is about the old value: it goes until the next save.
    setIssues((prev) => ({ byField: { ...prev.byField, [field]: undefined }, rest: prev.rest }));
  }

  async function save() {
    if (userId === null) return;
    try {
      await updateProject.mutateAsync({ actorId: userId, id: project.id, ...input });
    } catch (error) {
      setIssues(fieldIssues(error instanceof Error ? error.message : String(error), FIELDS));
      return;
    }
    setIssues({ byField: {}, rest: null });
    setDraft({ url: input.repositoryUrl ?? '', branch: input.defaultBranch ?? '' });
    setSaved(true);
  }

  const urlError = issues.byField.repositoryUrl;
  const branchError = issues.byField.defaultBranch;

  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="m-0 mb-6 font-sans text-20 font-600 text-gray-12">Repository</h2>
      <p className="mb-16 mt-0 max-w-520 font-sans text-12/17 text-gray-9">
        Where {project.name}'s code lives: its git link, the same for everyone. Each developer's own checkout is
        set on their machine, not here.
      </p>

      <Card padding={4} className="max-w-520">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty && !disabled) void save();
          }}
        >
          <div className="flex flex-col gap-14">
            <div>
              <FieldLabel htmlFor="repository-url">Git link</FieldLabel>
              <Input
                id="repository-url"
                className="mt-4 font-mono"
                placeholder="https://github.com/owner/repo"
                spellCheck={false}
                autoComplete="off"
                value={draft.url}
                disabled={disabled}
                tone={urlError ? 'danger' : undefined}
                aria-describedby={urlError ? 'repository-url-error' : 'repository-url-help'}
                onChange={(next) => edit({ ...draft, url: next }, 'repositoryUrl')}
              />
              {urlError ? (
                <FieldError id="repository-url-error">{urlError}</FieldError>
              ) : (
                <p id="repository-url-help" className="mb-0 mt-5 font-sans text-12/17 text-gray-9">
                  https://…, ssh://… or git@host:owner/repo. A web link opens from the project's page; any other is
                  there to copy.
                </p>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="repository-branch">Default branch</FieldLabel>
              <Input
                id="repository-branch"
                className="mt-4 w-240 font-mono"
                spellCheck={false}
                autoComplete="off"
                value={noLink ? '' : draft.branch}
                disabled={disabled || noLink}
                tone={branchError ? 'danger' : undefined}
                aria-describedby={branchError ? 'repository-branch-error' : 'repository-branch-help'}
                onChange={(next) => edit({ ...draft, branch: next }, 'defaultBranch')}
              />
              {branchError ? (
                <FieldError id="repository-branch-error">{branchError}</FieldError>
              ) : (
                <p id="repository-branch-help" className="mb-0 mt-5 font-sans text-12/17 text-gray-9">
                  {noLink ? 'Give the git link first.' : "Leave it empty for the repository's own default."}
                </p>
              )}
            </div>
          </div>

          {issues.rest ? <FieldError>{issues.rest}</FieldError> : null}

          <div className="mt-14 flex items-center justify-end gap-12">
            {saved ? (
              <span role="status" className="font-mono text-11 text-gray-9">
                saved
              </span>
            ) : null}
            <DisabledReason reason={disabled ? 'Choose who you are acting as to edit the repository' : undefined}>
              <Button type="submit" variant="solid" size="sm" disabled={disabled || !dirty} loading={updateProject.isPending}>
                Save
              </Button>
            </DisabledReason>
          </div>
        </form>
      </Card>
    </section>
  );
}
