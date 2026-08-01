import type React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaPanel } from './schema-panel';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mockNavigate,
}));

const databases = vi.fn();
vi.mock('../../api/use-schema', () => ({ useDatabases: () => databases() }));

describe('SchemaPanel', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('names the current database once loaded', () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    render(<SchemaPanel selected={undefined} />);
    expect(screen.getByRole('button', { name: /tickets/ })).toBeInTheDocument();
  });

  it('prefers the selected database over the current one', () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    render(<SchemaPanel selected="tickets_dev" />);
    expect(screen.getByRole('button', { name: /tickets_dev/ })).toBeInTheDocument();
  });

  it('renders nothing selectable while loading', () => {
    databases.mockReturnValue({ data: undefined, isLoading: true });
    render(<SchemaPanel selected={undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // These two exercise `choose()` directly — the default-database-is-absence
  // rule from Task 10 carried onto the write side. Deliberately NOT using the
  // current database as the "selection" test case: picking the default
  // cannot tell "wrote the param" apart from "correctly omitted it" (see
  // constraint #2 in the brief). So one test picks a database that is
  // clearly not current, and the other separately proves picking the current
  // one clears the param instead of writing it out.
  it('writes an explicit database param when choosing a database other than current', async () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    render(<SchemaPanel selected={undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Database: tickets' }));
    await userEvent.click(await screen.findByRole('button', { name: 'tickets_dev' }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/schema',
      search: { database: 'tickets_dev' },
    });
  });

  it('omits the database param entirely when choosing the current database', async () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    // Start on a non-default selection so the click genuinely changes
    // something, rather than choosing the value already shown.
    render(<SchemaPanel selected="tickets_dev" />);
    await userEvent.click(screen.getByRole('button', { name: 'Database: tickets_dev' }));
    await userEvent.click(await screen.findByRole('button', { name: 'tickets' }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/schema', search: {} });
  });
});
