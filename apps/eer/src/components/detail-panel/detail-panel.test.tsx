import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { DiagramActions } from '../../state/diagram-provider';
import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { EditorModals } from '../editor';
import { DetailPanel } from './detail-panel';

afterEach(cleanup);

// DetailPanel now reads model + panelSelection from the provider, so drive the
// selection through the same actions the app uses instead of a `selection` prop.
// Wrapped in <EditorModals/> — the Edit button calls useEditor(), which throws
// without it (same rationale as top-bar.test.tsx's renderWithEditor), and this
// is also what actually renders the routed modal when Edit is clicked.
async function renderPanel(select?: (a: DiagramActions) => void) {
  const result = await renderDiagram(
    <EditorModals>
      <DetailPanel />
    </EditorModals>,
    twoZoneRaw(),
  );
  if (select) await act(async () => select(result.actions));
  return result;
}

describe('DetailPanel', () => {
  it('renders the overview with the controls list when nothing is selected', async () => {
    await renderPanel();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.getByText('wheel')).toBeInTheDocument();
    expect(screen.getByText('zoom toward the cursor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fixture' })).toBeInTheDocument();
  });

  it('renders field rows and relationships for a selected entity', async () => {
    const { container } = await renderPanel((a) => a.selectEntity('users'));
    expect(screen.getByRole('heading', { name: 'users' })).toBeInTheDocument();
    expect(container.textContent).toContain('Zone One · 3 fields · 2 relationships');
    // fields: id / name / manager_id ('id' also appears in relationship rows)
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('manager_id')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();
    // relationships: rel:orders:c2 (users -> orders.users_id) points at orders,
    // rel:users:c2 (self-loop) points back at users
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('.users_id')).toBeInTheDocument();
    expect(screen.getByText('.manager_id')).toBeInTheDocument();
  });

  it('selecting an entity renders an Edit button that opens the table modal', async () => {
    await renderPanel((a) => a.selectEntity('users'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Edit users');
  });

  it('lists member tables for a selected group', async () => {
    const { container } = await renderPanel((a) => a.selectGroup('z2'));
    expect(screen.getByText('Zone')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zone Two' })).toBeInTheDocument();
    expect(container.textContent).toContain('2 tables');
    // 'orders' shows up in the tables list and again in the external rel row
    expect(screen.getAllByText('orders').length).toBeGreaterThan(0);
    expect(screen.getByText('tags')).toBeInTheDocument();
    // one external connection (rel:orders:c2 to users), rel:orders:c3 is internal
    expect(container.textContent).toContain('2 relationships (1 internal)');
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('selecting a group renders an Edit button that opens the group modal', async () => {
    await renderPanel((a) => a.selectGroup('z2'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Edit Zone Two');
  });

  it('shows both endpoints for a selected edge', async () => {
    await renderPanel((a) => a.isolate('rel:orders:c2'));
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
