import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardState } from './card-state';

// The four states, and their order: an error shows even while a retry is
// loading, and loading shows before an empty answer can be told from none.
describe('CardState', () => {
  it('shows the content when the answer is whole', () => {
    render(<CardState>12 running</CardState>);
    expect(screen.getByText('12 running')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('waits with a spinner and no content', () => {
    render(<CardState isLoading>12 running</CardState>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('12 running')).toBeNull();
  });

  it("shows an error's own message in place of the content", () => {
    render(<CardState error={new Error('The server did not answer in 5 s')}>12 running</CardState>);
    expect(screen.getByText('Could not load')).toBeInTheDocument();
    expect(screen.getByText('The server did not answer in 5 s')).toBeInTheDocument();
    expect(screen.queryByText('12 running')).toBeNull();
  });

  it('says the request failed for something thrown that is not an Error', () => {
    render(<CardState error="timeout">12 running</CardState>);
    expect(screen.getByText('The request failed.')).toBeInTheDocument();
  });

  it('shows the error over the spinner while a retry loads', () => {
    render(
      <CardState isLoading error={new Error('Gone')}>
        12 running
      </CardState>,
    );
    expect(screen.getByText('Gone')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes null as no error', () => {
    render(<CardState error={null}>12 running</CardState>);
    expect(screen.getByText('12 running')).toBeInTheDocument();
  });

  it('says what is empty instead of an empty card', () => {
    render(
      <CardState isEmpty emptyText="Nothing is running">
        12 running
      </CardState>,
    );
    expect(screen.getByText('Nothing is running')).toBeInTheDocument();
    expect(screen.queryByText('12 running')).toBeNull();
  });

  it('says nothing is here when it is empty and given no words', () => {
    render(<CardState isEmpty>12 running</CardState>);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('keeps a note on a partial answer with the content', () => {
    render(
      <CardState>
        <p>12 running</p>
        <p>One source did not answer</p>
      </CardState>,
    );
    expect(screen.getByText('12 running')).toBeInTheDocument();
    expect(screen.getByText('One source did not answer')).toBeInTheDocument();
  });

  it('spaces the content by its gap', () => {
    const { container } = render(<CardState gap={3}>12 running</CardState>);
    expect(container.firstElementChild?.className).toContain('gap-12');
  });
});
