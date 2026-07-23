import { useState } from 'react';
import type { Item } from '../api/types';
import { useCreateComment } from '../api/use-create-comment';
import { useCurrentUser } from '../state/current-user-context';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { RelativeDate } from '../ui/relative-date';
import type { BoardIndexes } from '../utils/index-board';
import { boardSuggestions } from './rich-text/board-suggestions';
import { RichTextEditor } from './rich-text/rich-text-editor';
import { RichTextView } from './rich-text/rich-text-view';

// Comment stream + rich-text composer. The section heading (or drawer tab)
// belongs to ItemDetail; this renders just the thread.
export function DetailComments({
  indexes,
  item,
  prefix,
  onOpenItem,
}: {
  indexes: BoardIndexes;
  item: Item;
  prefix: string;
  onOpenItem?: (number: number) => void;
}) {
  const { userId } = useCurrentUser();
  const createComment = useCreateComment();
  // The editor commits its draft on blur; the Comment button's click lands
  // after that blur, so `body` is current when submit runs.
  const [body, setBody] = useState('');
  // Remount the composer after a successful post so its draft clears.
  const [composerKey, setComposerKey] = useState(0);

  const comments = [...item.comments].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const me = userId !== null ? indexes.userById.get(userId) : undefined;

  const handleOpenTicket = (label: string) => {
    if (!onOpenItem) {
      return;
    }
    const n = Number(label.split('-').at(-1));
    if (Number.isFinite(n)) {
      onOpenItem(n);
    }
  };

  const submit = async () => {
    if (userId === null || body.trim().length === 0) {
      return;
    }
    await createComment.mutateAsync({
      itemId: item.id,
      actorId: userId,
      body: body.trim(),
    });
    setBody('');
    setComposerKey((key) => key + 1);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {comments.length === 0 ? (
        <p className="m-0 font-sans text-meta text-ink-3">No comments yet.</p>
      ) : (
        comments.map((comment) => {
          const author = indexes.userById.get(comment.authorId);
          const name = author?.name ?? `user ${comment.authorId}`;
          return (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar name={name} kind={author?.kind ?? 'human'} size="md" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="mb-0.75 flex items-baseline gap-2">
                  <span className="font-sans text-ui font-medium text-ink">{name}</span>
                  {author?.kind === 'agent' ? (
                    <span className="self-center rounded-[3px] bg-accent-subtle px-1.25 font-mono text-[9px] font-medium text-accent">
                      AGENT
                    </span>
                  ) : null}
                  <RelativeDate
                    value={comment.createdAt}
                    className="font-mono text-[11px] text-ink-3"
                  />
                </div>
                <RichTextView
                  value={comment.body}
                  className="font-sans text-ui leading-[1.55] text-ink"
                  onOpenTicket={handleOpenTicket}
                />
              </div>
            </div>
          );
        })
      )}
      <div className="flex gap-2.5">
        {me ? <Avatar name={me.name} kind={me.kind} size="md" className="mt-0.5" /> : null}
        <div className="min-w-0 flex-1">
          <RichTextEditor
            key={composerKey}
            value=""
            disabled={userId === null}
            features="compact"
            suggestions={boardSuggestions(indexes, prefix)}
            placeholder={userId === null ? 'Pick a user in the header to comment' : 'Comment…'}
            onSave={setBody}
          />
          {createComment.isError ? (
            <p className="m-0 mt-1 font-sans text-meta text-danger">
              {(createComment.error as Error).message}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary"
              size="compact"
              disabled={userId === null || createComment.isPending}
              onClick={() => void submit()}
            >
              Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
