import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Disclosure } from './disclosure';

const row = () => screen.getByRole('button', { name: 'Volumes' });

describe('Disclosure', () => {
  it('starts folded, with its summary beside the title and its content not drawn', () => {
    render(
      <Disclosure title="Volumes" summary="2 volumes">
        <p>The list</p>
      </Disclosure>,
    );
    expect(row()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('2 volumes')).toBeInTheDocument();
    expect(screen.queryByText('The list')).not.toBeInTheDocument();
  });

  it('opens on a click, drawing its content and putting its summary away', async () => {
    render(
      <Disclosure title="Volumes" summary="2 volumes">
        <p>The list</p>
      </Disclosure>,
    );
    await userEvent.click(row());
    expect(row()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The list')).toBeInTheDocument();
    expect(screen.queryByText('2 volumes')).not.toBeInTheDocument();
    await userEvent.click(row());
    expect(screen.queryByText('The list')).not.toBeInTheDocument();
  });

  it('opens from the keyboard, as a button does', async () => {
    render(
      <Disclosure title="Volumes">
        <p>The list</p>
      </Disclosure>,
    );
    row().focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('The list')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(screen.queryByText('The list')).not.toBeInTheDocument();
  });

  it('is named by its title and described by its summary while folded', () => {
    render(
      <Disclosure title="Volumes" summary="2 volumes">
        <p>The list</p>
      </Disclosure>,
    );
    // The summary is inside the button, but not part of its name.
    expect(row()).toHaveAccessibleDescription('2 volumes');
  });

  it('points at its content only while the content is there', async () => {
    render(
      <Disclosure title="Volumes">
        <p>The list</p>
      </Disclosure>,
    );
    expect(row()).not.toHaveAttribute('aria-controls');
    await userEvent.click(row());
    const id = row().getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id ?? '')).toHaveTextContent('The list');
  });

  it('starts open with defaultOpen', () => {
    render(
      <Disclosure title="Volumes" defaultOpen>
        <p>The list</p>
      </Disclosure>,
    );
    expect(screen.getByText('The list')).toBeInTheDocument();
  });

  it('tells onOpenChange each new state when it holds its own', async () => {
    const onOpenChange = vi.fn();
    render(
      <Disclosure title="Volumes" onOpenChange={onOpenChange}>
        <p>The list</p>
      </Disclosure>,
    );
    await userEvent.click(row());
    await userEvent.click(row());
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  describe('controlled', () => {
    it('follows open, and only asks to change it', async () => {
      const onOpenChange = vi.fn();
      render(
        <Disclosure title="Volumes" open={false} onOpenChange={onOpenChange}>
          <p>The list</p>
        </Disclosure>,
      );
      await userEvent.click(row());
      expect(onOpenChange).toHaveBeenCalledWith(true);
      // The caller kept it closed, so it stays closed.
      expect(screen.queryByText('The list')).not.toBeInTheDocument();
    });

    it('opens and closes with the state it is given', async () => {
      function Section() {
        const [open, setOpen] = useState(true);
        return (
          <>
            <Disclosure title="Volumes" open={open} onOpenChange={setOpen}>
              <p>The list</p>
            </Disclosure>
            <button type="button" onClick={() => setOpen(false)}>
              Fold all
            </button>
          </>
        );
      }
      render(<Section />);
      expect(screen.getByText('The list')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Fold all' }));
      expect(screen.queryByText('The list')).not.toBeInTheDocument();
      await userEvent.click(row());
      expect(screen.getByText('The list')).toBeInTheDocument();
    });
  });

  it('keeps two folds’ ids apart', async () => {
    render(
      <>
        <Disclosure title="Volumes" defaultOpen>
          <p>The list</p>
        </Disclosure>
        <Disclosure title="Ports" defaultOpen>
          <p>The ports</p>
        </Disclosure>
      </>,
    );
    const volumes = row().getAttribute('aria-controls');
    const ports = screen.getByRole('button', { name: 'Ports' }).getAttribute('aria-controls');
    expect(volumes).not.toBe(ports);
  });

  it('draws a rule to the row’s end when asked, hidden from assistive tech', () => {
    const { container, rerender } = render(
      <Disclosure title="Volumes">
        <p>The list</p>
      </Disclosure>,
    );
    expect(container.querySelector('.flex-1[aria-hidden]')).toBeNull();
    rerender(
      <Disclosure title="Volumes" rule>
        <p>The list</p>
      </Disclosure>,
    );
    expect(container.querySelector('.flex-1[aria-hidden]')).not.toBeNull();
  });

  it('takes a size, and keeps the caller’s className on its outer element', () => {
    const { container } = render(
      <Disclosure title="Volumes" size="sm" className="mt-8">
        <p>The list</p>
      </Disclosure>,
    );
    expect(container.firstElementChild).toHaveClass('mt-8');
    // A quiet line is only as wide as its words.
    expect(row()).toHaveClass('self-start', 'text-12/17');
  });
});
