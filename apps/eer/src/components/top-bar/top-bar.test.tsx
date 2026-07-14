import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DiagramUi } from '../../state/diagram-reducer';
import { useDiagramUi } from '../../state/diagram-context';
import { DiagramProvider } from '../../state/diagram-provider';
import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { EditorModals } from '../editor';
import { TopBar } from './top-bar';

afterEach(cleanup);

// TopBar's "+ Add" button calls useEditor(), which throws without an
// <EditorModals/> ancestor — see model-menu.test.tsx's renderWithEditor for
// the same rationale.
function renderWithEditor(ui: ReactNode, raw?: unknown) {
  return renderDiagram(<EditorModals>{ui}</EditorModals>, raw);
}

// The provider is the only source of model/view/ui now, so probe its ui slice
// to assert the chip toggles land in state (replacing the old onToggle* spies).
let uiRef: DiagramUi | null = null;
function UiGrab() {
  uiRef = useDiagramUi();
  return null;
}

describe('TopBar', () => {
  it('falls back to the default title while no model is loaded', () => {
    render(
      <DiagramProvider>
        <EditorModals>
          <TopBar />
        </EditorModals>
      </DiagramProvider>,
    );
    expect(screen.getByRole('heading', { name: 'EER model viewer' })).toBeInTheDocument();
    expect(screen.getByText('loading…')).toBeInTheDocument();
    expect(screen.queryByText('Zones')).not.toBeInTheDocument();
  });

  it('renders the model title plus zone and kind chips', async () => {
    await renderWithEditor(<TopBar />, twoZoneRaw());
    expect(screen.getByRole('heading', { name: 'Fixture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone Two' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FK constraint' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Many-to-many' })).toBeInTheDocument();
  });

  it('clicking a chip toggles the group/kind hidden state', async () => {
    await renderWithEditor(
      <>
        <UiGrab />
        <TopBar />
      </>,
      twoZoneRaw(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zone Two' }));
    expect(uiRef!.hidden.groups.has('z2')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Many-to-many' }));
    expect(uiRef!.hidden.kinds.has('nm')).toBe(true);
  });

  it('Fit / Rearrange dispatch their actions', async () => {
    const { actions } = await renderWithEditor(<TopBar />, twoZoneRaw());
    const fit = vi.spyOn(actions, 'fit');
    const rearrange = vi.spyOn(actions, 'rearrange');
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(fit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rearrange' }));
    expect(rearrange).toHaveBeenCalledTimes(1);
  });

  it('the routing button reflects view.routing and cycles on click', async () => {
    // twoZoneRaw loads with routing='avoid'; one click advances avoid → ortho.
    await renderWithEditor(<TopBar />, twoZoneRaw());
    fireEvent.click(screen.getByRole('button', { name: 'Lines: avoid' }));
    expect(screen.getByRole('button', { name: 'Lines: ortho' })).toBeInTheDocument();
  });
});
