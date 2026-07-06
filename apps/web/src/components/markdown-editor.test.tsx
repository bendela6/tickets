import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

test('previews markdown in the Preview tab', async () => {
  render(<MarkdownEditor value={'## Repro'} onSave={() => {}} />);
  await userEvent.click(screen.getByRole('tab', { name: /preview/i }));
  expect(screen.getByRole('heading', { name: 'Repro' })).toBeInTheDocument();
});

test('saves the edited draft on blur', async () => {
  const onSave = vi.fn();
  render(<MarkdownEditor value="" onSave={onSave} />);
  const textarea = screen.getByRole('textbox');
  await userEvent.type(textarea, 'hello');
  textarea.blur();
  expect(onSave).toHaveBeenCalledWith('hello');
});
