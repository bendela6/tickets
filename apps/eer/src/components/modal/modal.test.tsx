import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

afterEach(cleanup);

describe('Modal', () => {
  it('renders an accessible dialog with its title and children', () => {
    render(
      <Modal title="Example modal" onClose={() => {}}>
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Example modal' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Example modal" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Example modal" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The backdrop, not the panel, is the scroll container — so a tall dialog is
  // scrolled as a whole rather than scrolling its body. That puts a centring
  // wrapper between the backdrop and the panel; clicking IT is still "outside".
  it('scrolls on the backdrop, not the panel, and closes on a click in the centring gutter', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Example modal" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    const panel = screen.getByRole('dialog');
    expect(panel.className).not.toMatch(/overflow|max-h-/);

    const backdrop = panel.parentElement?.parentElement as HTMLElement;
    expect(backdrop.className).toMatch(/overflow-y-auto/);

    fireEvent.click(panel.parentElement as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a click lands inside the panel', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Example modal" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has a visible close button that calls onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Example modal" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
