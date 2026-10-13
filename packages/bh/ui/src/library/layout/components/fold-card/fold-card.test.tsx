import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FoldCard } from './fold-card';

const header = () => screen.getByRole('button', { name: 'Stack' });

describe('FoldCard', () => {
  it('is a card whose header is the title, a level-3 heading', () => {
    render(
      <FoldCard title="Stack" summary="3 services">
        <p>The settings</p>
      </FoldCard>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toContainElement(header());
    expect(header()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveAccessibleDescription('3 services');
    expect(screen.queryByText('The settings')).not.toBeInTheDocument();
  });

  it('opens on a click of its header, and the summary goes', async () => {
    render(
      <FoldCard title="Stack" summary="3 services">
        <p>The settings</p>
      </FoldCard>,
    );
    await userEvent.click(header());
    expect(header()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The settings')).toBeInTheDocument();
    expect(screen.queryByText('3 services')).not.toBeInTheDocument();
    const id = header().getAttribute('aria-controls');
    expect(document.getElementById(id ?? '')).toHaveTextContent('The settings');
  });

  it('rules its header off from the body only while open', async () => {
    render(
      <FoldCard title="Stack">
        <p>The settings</p>
      </FoldCard>,
    );
    expect(header()).not.toHaveClass('border-b-1');
    await userEvent.click(header());
    expect(header()).toHaveClass('border-b-1');
  });

  it('follows open when given it, and only asks to change it', async () => {
    const onOpenChange = vi.fn();
    render(
      <FoldCard title="Stack" open onOpenChange={onOpenChange}>
        <p>The settings</p>
      </FoldCard>,
    );
    await userEvent.click(header());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('The settings')).toBeInTheDocument();
  });

  it('starts open with defaultOpen', () => {
    render(
      <FoldCard title="Stack" defaultOpen>
        <p>The settings</p>
      </FoldCard>,
    );
    expect(screen.getByText('The settings')).toBeInTheDocument();
  });

  it('pads its body as CardBody does, by 16 pixels unless told otherwise', () => {
    const { rerender } = render(
      <FoldCard title="Stack" defaultOpen>
        <p>The settings</p>
      </FoldCard>,
    );
    expect(screen.getByText('The settings').parentElement).toHaveClass('p-16');
    rerender(
      <FoldCard title="Stack" defaultOpen padding={0}>
        <p>The settings</p>
      </FoldCard>,
    );
    expect(screen.getByText('The settings').parentElement).toHaveClass('p-0');
  });

  it('keeps the caller’s className on the card', () => {
    const { container } = render(
      <FoldCard title="Stack" className="mt-12">
        <p>The settings</p>
      </FoldCard>,
    );
    expect(container.firstElementChild).toHaveClass('mt-12', 'overflow-hidden');
  });
});
