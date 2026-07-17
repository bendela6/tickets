import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromptComposer } from './prompt-composer';

const base = {
  value: 'hello',
  onChange: () => {},
  model: 'claude-opus-4-8',
  onModelChange: () => {},
  effort: 'medium',
  onEffortChange: () => {},
};

describe('PromptComposer run control', () => {
  it('shows Send when idle and calls onSend', async () => {
    const onSend = vi.fn();
    render(<PromptComposer {...base} onSend={onSend} onInterrupt={() => {}} running={false} />);
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('replaces Send with Stop while running and calls onInterrupt', async () => {
    const onInterrupt = vi.fn();
    render(<PromptComposer {...base} onSend={() => {}} onInterrupt={onInterrupt} running />);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('disables Send with empty input', () => {
    render(<PromptComposer {...base} value="  " onSend={() => {}} onInterrupt={() => {}} running={false} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
