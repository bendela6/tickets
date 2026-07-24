import { render, screen } from '@testing-library/react';
import { StateGrid } from './state-grid';
import { collectDemos, isDemoError } from '@tickets/ui/gallery';

const demo = collectDemos({
  './x.demo.tsx': {
    meta: { title: 'Button', group: 'Form controls' },
    states: [
      { name: 'primary', render: () => <button>New ticket</button> },
      { name: 'loading', render: () => <button>Creating…</button> },
    ],
  },
})[0]!;

describe('StateGrid', () => {
  it('renders the title, STATES label, one labeled card per state, and stable ids', () => {
    if (isDemoError(demo)) throw new Error(demo.error);
    render(<StateGrid demo={demo} />);
    expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('STATES')).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(document.getElementById('button--primary')).toBeTruthy();
    expect(document.getElementById('button--loading')).toBeTruthy();
    expect(screen.getByText('New ticket')).toBeTruthy();
  });
});
