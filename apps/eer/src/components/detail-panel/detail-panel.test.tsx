import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Selection } from '../../engine/model/types';
import { buildModel, twoZoneRaw } from '../../test/models';
import { DetailPanel } from './detail-panel';

afterEach(cleanup);

const model = buildModel(twoZoneRaw());

function renderPanel(selection: Selection) {
  return render(<DetailPanel engine={null} model={model} selection={selection} />);
}

describe('DetailPanel', () => {
  it('renders the overview with the controls list when nothing is selected', () => {
    renderPanel({ type: 'none' });
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.getByText('wheel')).toBeInTheDocument();
    expect(screen.getByText('zoom toward the cursor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fixture' })).toBeInTheDocument();
  });

  it('renders field rows and relationships for a selected entity', () => {
    const { container } = renderPanel({ type: 'entity', id: 'users' });
    expect(screen.getByRole('heading', { name: 'users' })).toBeInTheDocument();
    expect(container.textContent).toContain('Zone One · 3 fields · 2 relationships');
    // fields: id / name / manager_id ('id' also appears in relationship rows)
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('manager_id')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();
    // relationships: u-o points at orders, self points back at users
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('.users_id')).toBeInTheDocument();
    expect(screen.getByText('.manager_id')).toBeInTheDocument();
  });

  it('lists member tables for a selected group', () => {
    const { container } = renderPanel({ type: 'group', id: 'z2' });
    expect(screen.getByText('Zone')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zone Two' })).toBeInTheDocument();
    expect(container.textContent).toContain('2 tables');
    // 'orders' shows up in the tables list and again in the external rel row
    expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
    expect(screen.getByText('tags')).toBeInTheDocument();
    // one external connection (u-o to users), t-o is internal
    expect(container.textContent).toContain('2 relationships (1 internal)');
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('shows both endpoints for a selected edge', () => {
    renderPanel({ type: 'edge', id: 'u-o' });
    expect(screen.getByText('Relationship')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'users → orders' })).toBeInTheDocument();
    expect(screen.getByText('source')).toBeInTheDocument();
    expect(screen.getByText('target')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('.id')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('.users_id')).toBeInTheDocument();
  });
});
