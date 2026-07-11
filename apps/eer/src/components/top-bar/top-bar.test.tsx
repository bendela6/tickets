import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel, twoZoneRaw } from '../../test/models';
import { TopBar } from './top-bar';

afterEach(cleanup);

type Props = ComponentProps<typeof TopBar>;

function renderBar(over: Partial<Props> = {}) {
  const props: Props = {
    engine: null,
    model: null,
    routing: 'curved',
    onCycleRouting: vi.fn(),
    hiddenGroups: new Set<string>(),
    hiddenKinds: new Set<string>(),
    onToggleGroup: vi.fn(),
    onToggleKind: vi.fn(),
    onFit: vi.fn(),
    onRearrange: vi.fn(),
    onSelfCheck: vi.fn(),
    ...over,
  };
  render(<TopBar {...props} />);
  return props;
}

describe('TopBar', () => {
  it('falls back to the default title while no model is loaded', () => {
    renderBar({ model: null });
    expect(screen.getByRole('heading', { name: 'EER model viewer' })).toBeInTheDocument();
    expect(screen.getByText('loading…')).toBeInTheDocument();
    expect(screen.queryByText('Zones')).not.toBeInTheDocument();
  });

  it('renders the model title plus zone and kind chips', () => {
    renderBar({ model: buildModel(twoZoneRaw()) });
    expect(screen.getByRole('heading', { name: 'Fixture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone Two' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FK constraint' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Many-to-many' })).toBeInTheDocument();
  });

  it('clicking a chip reports the group/kind id', () => {
    const props = renderBar({ model: buildModel(twoZoneRaw()) });
    fireEvent.click(screen.getByRole('button', { name: 'Zone Two' }));
    expect(props.onToggleGroup).toHaveBeenCalledWith('z2');
    fireEvent.click(screen.getByRole('button', { name: 'Many-to-many' }));
    expect(props.onToggleKind).toHaveBeenCalledWith('nm');
  });

  it('Fit / Rearrange / Self-check buttons call their handlers', () => {
    const props = renderBar({ model: buildModel(twoZoneRaw()) });
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(props.onFit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rearrange' }));
    expect(props.onRearrange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Self-check' }));
    expect(props.onSelfCheck).toHaveBeenCalledTimes(1);
  });

  it('the routing button label reflects the routing prop and cycles on click', () => {
    const props = renderBar({ model: buildModel(twoZoneRaw()), routing: 'avoid' });
    const btn = screen.getByRole('button', { name: 'Lines: avoid' });
    fireEvent.click(btn);
    expect(props.onCycleRouting).toHaveBeenCalledTimes(1);
  });
});
