import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Tooltip } from '@tickets/ui';
import { useEffect, useState } from 'react';

// Claude Code generates a session title into the transcript. A rename is stored as an
// override the board owns, so clearing the field restores the generated one rather
// than leaving the session nameless.

export function SessionTitle({
  id,
  title,
  isCustom,
  fallback,
}: {
  id: string;
  title: string | null;
  isCustom: boolean;
  /** Shown when there is no title at all — usually the project name. */
  fallback: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const queryClient = useQueryClient();

  // Polling replaces the title underneath; re-sync only while not editing, or a
  // refetch mid-edit would overwrite what is being typed.
  useEffect(() => {
    if (!editing) setDraft(title ?? '');
  }, [title, editing]);

  const save = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch(`/api/session/${id}/title`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error(`rename failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['session', id] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });

  if (editing) {
    return (
      <form
        className="flex items-center gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(draft);
        }}
      >
        <Input
          autoFocus
          aria-label="Session title"
          value={draft}
          onChange={(next) => setDraft(next)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(title ?? '');
              setEditing(false);
            }
          }}
          placeholder="Leave empty to restore the generated title"
        />
        <Button type="submit" size="sm" tone="primary" disabled={save.isPending}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(title ?? '');
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <span className="group flex items-center gap-8">
      <h1 className="min-w-0 font-semibold text-18 text-gray-12 tracking-tight">
        {title ?? fallback}
      </h1>
      <Tooltip content={isCustom ? 'Renamed — edit or clear to restore' : 'Rename this session'}>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Rename session"
          onClick={() => setEditing(true)}
        >
          Rename
        </Button>
      </Tooltip>
      {save.isError ? <span className="text-12 text-red-11">rename failed</span> : null}
    </span>
  );
}
