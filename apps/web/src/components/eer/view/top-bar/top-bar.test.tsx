import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiagramProvider } from '../../state/diagram-provider';
import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { TopBar } from './top-bar';

afterEach(cleanup);

describe('TopBar', () => {
  // The toolbar is now three controls and nothing else — the title, the search
  // box, the group chips and the edge-kind chips all moved to the outline. This
  // is the assertion that keeps them from creeping back.
  it('carries only Lines, Fit and Rearrange', async () => {
    await renderDiagram(<TopBar />, twoZoneRaw());
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Lines: avoid▾',
      'Fit',
      'Rearrange',
    ]);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zone One' })).not.toBeInTheDocument();
  });

  it('renders without a model, since the toolbar reads none', () => {
    // The canvas mounts before the schema resolves; the toolbar has to survive
    // that frame rather than reaching into a model that is not there yet.
    render(
      <DiagramProvider>
        <TopBar />
      </DiagramProvider>,
    );
    expect(screen.getByRole('button', { name: 'Lines: curved' })).toBeInTheDocument();
  });

  it('Fit / Rearrange dispatch their actions', async () => {
    const { actions } = await renderDiagram(<TopBar />, twoZoneRaw());
    const fit = vi.spyOn(actions, 'fit');
    const rearrange = vi.spyOn(actions, 'rearrange');
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(fit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rearrange' }));
    expect(rearrange).toHaveBeenCalledTimes(1);
  });

  it('the Lines menu offers every mode and applies the one picked', async () => {
    // twoZoneRaw loads with routing='avoid'. A menu, not a cycle button: the
    // point of the change is that 'ortho' is reachable in one click from
    // 'avoid' AND that 'curved' — two steps away in the old cycle — is too.
    await renderDiagram(<TopBar />, twoZoneRaw());
    fireEvent.click(screen.getByRole('button', { name: 'Lines: avoid' }));
    expect(screen.getByRole('button', { name: /Ortho/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Curved/ }));
    expect(screen.getByRole('button', { name: 'Lines: curved' })).toBeInTheDocument();
  });
});
