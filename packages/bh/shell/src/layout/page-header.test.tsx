// PageHeader: the title is the page's h1, the back button navigates where it
// was told, the summary and actions render beside the title, and the
// breadcrumb links the steps that are pages.

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => {
  return {
    useNavigate: () => navigate,
    Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  };
});

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('titles the page and renders the summary and actions', () => {
    render(
      <PageHeader
        title="Boxes"
        description="Every box"
        summary={<p>12 boxes</p>}
        actions={<button type="button">New box</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Boxes' })).toBeInTheDocument();
    expect(screen.getByText('Every box')).toBeInTheDocument();
    expect(screen.getByText('12 boxes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New box' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('goes back to the route it was given', async () => {
    render(<PageHeader title="Box 7" backRoute={{ to: '/boxes' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/boxes' });
  });

  it('draws the breadcrumb over the title, linking only the steps that are pages', () => {
    render(
      <PageHeader
        title="Box 7"
        breadcrumb={[{ label: 'Storage' }, { label: 'Boxes', path: '/boxes' }]}
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(trail).toHaveTextContent('StorageBoxes');
    expect(screen.getByRole('link', { name: 'Boxes' })).toHaveAttribute('href', '/boxes');
    expect(screen.queryByRole('link', { name: 'Storage' })).toBeNull();
  });

  it('draws no breadcrumb without one', () => {
    render(<PageHeader title="Boxes" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('holds everything in the inner block it is given, inside the full-width band', () => {
    render(
      <PageHeader title="Boxes" breadcrumb={[{ label: 'Storage' }]} contentClassName="inner" />,
    );
    const inner = screen.getByRole('heading', { level: 1 }).closest('.inner');
    expect(inner).not.toBeNull();
    expect(inner).toContainElement(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(inner?.parentElement?.tagName).toBe('HEADER');
  });

  it('takes rich text as the description', () => {
    render(
      <PageHeader
        title="Boxes"
        size="lg"
        description={
          <>
            Sorted by <code>label</code>
          </>
        }
      />,
    );
    expect(screen.getByText('label').tagName).toBe('CODE');
  });
});
