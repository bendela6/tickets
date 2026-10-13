import { forwardRef, createRef, type AnchorHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { focusRing } from '../../../../style';
import { TextLink } from './text-link';

// Stands in for a router's link: a component that renders its own `<a>` from
// props it alone understands, and spreads the rest onto it.
const RouterLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
>(function RouterLink({ to, ...rest }, ref) {
  return <a ref={ref} href={`#${to}`} {...rest} />;
});

describe('TextLink', () => {
  it('is an <a> to where it is given', () => {
    render(<TextLink href="https://example.com">Example</TextLink>);
    expect(screen.getByRole('link', { name: 'Example' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  it('wears the link look and the library-wide inward ring', () => {
    render(<TextLink href="#">Example</TextLink>);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('text-gray-12', 'underline-offset-2', 'hover:underline');
    expect(link.className).toContain(focusRing('indigo', 'focus-visible', 'inward'));
  });

  it('lets a caller’s colour and size win over its own', () => {
    // A link can be red, for something that failed, or set its own type size:
    // tailwind-merge has to evict gray-12 for the first and keep it for the
    // second.
    const { rerender } = render(
      <TextLink href="#" className="text-red-11">
        Failed
      </TextLink>,
    );
    expect(screen.getByRole('link')).toHaveClass('text-red-11');
    expect(screen.getByRole('link')).not.toHaveClass('text-gray-12');
    rerender(
      <TextLink href="#" className="text-13 font-mono">
        Failed
      </TextLink>,
    );
    expect(screen.getByRole('link')).toHaveClass('text-gray-12', 'text-13', 'font-mono');
  });

  it('forwards its ref and other attributes to the <a>', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <TextLink ref={ref} href="#" target="_blank" rel="noreferrer">
        Example
      </TextLink>,
    );
    expect(ref.current).toBe(screen.getByRole('link'));
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });

  describe('with asChild', () => {
    it('styles a router’s link, which still draws its own <a>', () => {
      render(
        <TextLink asChild>
          <RouterLink to="/settings">Settings</RouterLink>
        </TextLink>,
      );
      const link = screen.getByRole('link', { name: 'Settings' });
      expect(link).toHaveAttribute('href', '#/settings');
      expect(link).toHaveClass('text-gray-12', 'hover:underline');
      // One element: the child's, not an <a> around it.
      expect(link.parentElement?.tagName).not.toBe('A');
    });

    it('merges the child’s classes and the caller’s, the child’s colour winning', () => {
      render(
        <TextLink asChild className="font-mono">
          <RouterLink to="/" className="text-orange-11">
            Variables
          </RouterLink>
        </TextLink>,
      );
      const link = screen.getByRole('link');
      expect(link).toHaveClass('text-orange-11', 'font-mono', 'hover:underline');
      expect(link).not.toHaveClass('text-gray-12');
    });

    it('makes a <button> read as a link, and keeps it a button', async () => {
      const onClick = vi.fn();
      render(
        <TextLink asChild>
          <button type="button" onClick={onClick}>
            Change
          </button>
        </TextLink>,
      );
      const button = screen.getByRole('button', { name: 'Change' });
      expect(button).toHaveClass('text-gray-12', 'hover:underline');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      await userEvent.click(button);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('calls both its own handler and the child’s', async () => {
      const own = vi.fn();
      const child = vi.fn();
      render(
        <TextLink asChild onClick={own}>
          <button type="button" onClick={child}>
            Log
          </button>
        </TextLink>,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(own).toHaveBeenCalledOnce();
      expect(child).toHaveBeenCalledOnce();
    });
  });
});
