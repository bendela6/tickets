import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { buildMessageStream } from './build-message-stream';
import { MessageStream } from './message-stream';

function renderApproval(onRespond: (id: string, r: 'allow' | 'deny', reason?: string) => void) {
  render(
    <MessageStream
      blocks={buildMessageStream([
        { seq: 1, event: { type: 'permission_request', id: 'p1', toolName: 'Bash', input: { command: 'rm -rf x' } } },
      ])}
      onRespond={onRespond}
    />,
  );
}

test('Allow sends an allow permission for the request id', () => {
  const onRespond = vi.fn();
  renderApproval(onRespond);
  expect(screen.getByText('Approval required')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
  expect(onRespond).toHaveBeenCalledWith('p1', 'allow', undefined);
  // After deciding, the action buttons are gone and it reads "allowed".
  expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
  expect(screen.getByText('allowed')).toBeInTheDocument();
});

test('Deny reveals a reason box and sends the reason', () => {
  const onRespond = vi.fn();
  renderApproval(onRespond);
  fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
  fireEvent.change(screen.getByPlaceholderText(/Why deny/i), { target: { value: 'too risky' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deny' }));
  expect(onRespond).toHaveBeenCalledWith('p1', 'deny', 'too risky');
});

test('renders the tool input for a non-diff tool', () => {
  render(
    <MessageStream
      blocks={buildMessageStream([
        { seq: 1, event: { type: 'permission_request', id: 'p2', toolName: 'Bash', input: { command: 'ls -la' } } },
      ])}
      onRespond={() => {}}
    />,
  );
  expect(screen.getByText(/ls -la/)).toBeInTheDocument();
});
