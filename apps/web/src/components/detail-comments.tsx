import { OWN_ERROR } from '../api/mutation-meta';
import { useState } from 'react';
import type { Item } from '../api/types';
import { useCreateComment } from '../api/use-create-comment';
import { useCurrentUser } from '../state/current-user-context';
import { Avatar, RelativeDate, ScreenState } from '@bh/ui';
import { avatarFor } from '../domain/actor';
import type { BoardIndexes } from '../utils/index-board';
import { boardSuggestions } from './rich-text/board-suggestions';
import { RichTextEditor } from './rich-text/rich-text-editor';
import { RichTextView } from './rich-text/rich-text-view';

// Comment stream + rich-text composer. The section heading (or drawer tab)
// belongs to ItemDetail; this renders just the thread.
export function DetailComments({
  indexes,
  item,
  onOpenItem,
}: {
  indexes: BoardIndexes;
  item: Item;
  onOpenItem?: (itemKey: string) => void;
}) {
  const { userId } = useCurrentUser();
  const createComment = useCreateComment(OWN_ERROR);
  // Remount the composer after a successful post so its draft clears.
  const [composerKey, setComposerKey] = useState(0);

  const comments = [...item.comments].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const me = userId !== null ? indexes.userById.get(userId) : undefined;

  // A #ref chip's label is the item's key.
  const handleOpenTicket = (label: string) => {
    if (onOpenItem && indexes.itemByKey.has(label)) {
      onOpenItem(label);
    }
  };

  // Called both from the composer's Comment button and its ⌘↩ shortcut —
  // RichTextEditor passes the doc it just serialized straight off the live
  // editor instance, so this never depends on a blur having landed first.
  const submit = async (body: string) => {
    if (userId === null || body.trim().length === 0) {
      return;
    }
    await createComment.mutateAsync({
      itemId: item.id,
      actorId: userId,
      body: body.trim(),
    });
    setComposerKey((key) => key + 1);
  };

  return (
    <div className="flex flex-col gap-14">
      {comments.length === 0 ? (
        <ScreenState className="px-12 py-20" title="No comments yet." />
      ) : (
        comments.map((comment) => {
          const author = indexes.userById.get(comment.authorId);
          const name = author?.name ?? `user ${comment.authorId}`;
          return (
            <div key={comment.id} className="flex gap-10">
              <Avatar name={name} {...avatarFor(author?.kind ?? 'human')} size="md" className="mt-2" />
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-baseline gap-8">
                  <span className="font-sans text-13/19 font-500 text-gray-12">{name}</span>
                  {author?.kind === 'agent' ? (
                    <span className="self-center rounded-4 bg-indigo-3 px-5 font-mono text-9 font-500 text-indigo-9">
                      AGENT
                    </span>
                  ) : null}
                  <RelativeDate
                    value={comment.createdAt}
                    className="font-mono text-11 text-gray-9"
                  />
                </div>
                <RichTextView
                  value={comment.body}
                  className="font-sans text-13/19 leading-[1.55] text-gray-12"
                  onOpenTicket={handleOpenTicket}
                />
              </div>
            </div>
          );
        })
      )}
      <div className="flex gap-10">
        {me ? <Avatar name={me.name} {...avatarFor(me.kind)} size="md" className="mt-2" /> : null}
        <div className="min-w-0 flex-1">
          <RichTextEditor
            key={composerKey}
            value=""
            disabled={userId === null}
            features="compact"
            suggestions={boardSuggestions(indexes)}
            placeholder={userId === null ? 'Pick a user in the header to comment' : 'Comment…'}
            composer={{
              onSubmit: (body) => void submit(body),
              submitDisabled: userId === null || createComment.isPending,
              submitPending: createComment.isPending,
            }}
          />
          {createComment.isError ? (
            <p className="m-0 mt-4 font-sans text-12/17 text-red-9">
              {(createComment.error as Error).message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
