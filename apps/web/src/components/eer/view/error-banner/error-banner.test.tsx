import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBanner } from './error-banner';

afterEach(cleanup);

describe('ErrorBanner', () => {
  it('renders nothing when there are no errors or warnings', () => {
    const { container } = render(<ErrorBanner errors={[]} warnings={[]} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error header with one list item per message', () => {
    render(<ErrorBanner errors={['bad ref', 'missing id']} warnings={[]} onDismiss={() => {}} />);
    expect(screen.getByText('2 error(s) — the model cannot render')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('bad ref')).toBeInTheDocument();
    expect(screen.getByText('missing id')).toBeInTheDocument();
  });

  it('shows a warning header in warning-only mode and lists the warnings', () => {
    render(<ErrorBanner errors={[]} warnings={['field type unknown']} onDismiss={() => {}} />);
    expect(screen.getByText('1 warning(s)')).toBeInTheDocument();
    expect(screen.queryByText(/error\(s\)/)).not.toBeInTheDocument();
    expect(screen.getByText('field type unknown')).toBeInTheDocument();
  });

  it('fires onDismiss from the × button', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner errors={['boom']} warnings={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
