import { useState } from 'react';
import type { BoardTicket } from '../api/types';
import { useCreateComment } from '../api/use-create-comment';
import { renderMarkdown } from '../lib/render-markdown';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

export function DetailComments({
  indexes,
  ticket,
}: {
  indexes: BoardIndexes;
  ticket: BoardTicket;
}) {
  const { userId } = useCurrentUser();
  const createComment = useCreateComment();
  const [body, setBody] = useState('');
  const comments = [...ticket.comments].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  return (
    <div className="comments">
      <h2>Comments</h2>
      {comments.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No comments yet.</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="comment">
            <div className="meta">
              <b>{indexes.userById.get(comment.authorId)?.name ?? `user ${comment.authorId}`}</b> ·{' '}
              {new Date(comment.createdAt).toLocaleString()}
            </div>
            <div
              className="text md"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }}
            />
          </div>
        ))
      )}
      <form
        className="comment-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (userId === null || body.trim().length === 0) {
            return;
          }
          await createComment.mutateAsync({
            ticketId: ticket.id,
            authorId: userId,
            body: body.trim(),
          });
          setBody('');
        }}
      >
        <textarea
          rows={3}
          placeholder={userId === null ? 'Pick a user in the header to comment' : 'Add a comment…'}
          value={body}
          disabled={userId === null}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="row">
          <span className="spacer" />
          <button type="submit" className="btn primary" disabled={userId === null}>
            Add comment
          </button>
        </div>
      </form>
    </div>
  );
}
