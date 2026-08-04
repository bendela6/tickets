import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Decision } from '../../shared/types';
import { DecisionsPanel } from './decisions-panel';

// The four option states are the point of this panel: an option can be recommended,
// chosen, both, or neither. The state that matters most is a recommendation the user
// overruled — it has to stay visible rather than be quietly dropped.

function decision(over: Partial<Decision> = {}): Decision {
  return {
    id: 1,
    topic: 'Git behaviour',
    status: 'decided',
    context: 'The report ends with a git section.',
    question: 'What should the skill do about git?',
    options: [
      { label: 'Report and offer to act', detail: 'A picker after the report', recommended: true },
      { label: 'Report only', detail: 'Never touches git beyond reads', chosen: true },
      { label: 'Auto-run the safe parts' },
    ],
    decided: 'Report only',
    ...over,
  };
}

describe('DecisionsPanel', () => {
  it('says so plainly when nothing has been settled', () => {
    render(<DecisionsPanel decisions={[]} />);
    expect(screen.getByText(/nothing settled/i)).toBeInTheDocument();
  });

  it('keeps a recommendation that was overruled visible next to the chosen option', () => {
    render(<DecisionsPanel decisions={[decision()]} />);

    // The winning label appears twice — once as an option, once as the outcome — so
    // the option row has to be picked out rather than matched by text alone.
    const optionRow = (label: string) =>
      screen
        .getAllByText(label)
        .map((el) => el.closest('li'))
        .find(Boolean) as HTMLElement;

    const overruled = optionRow('Report and offer to act');
    const chosen = optionRow('Report only');

    expect(within(overruled).getByText('recommended')).toBeInTheDocument();
    expect(within(overruled).queryByText('chosen')).not.toBeInTheDocument();
    expect(within(chosen).getByText('chosen')).toBeInTheDocument();
  });

  it('marks an option that was both recommended and chosen with both labels', () => {
    const d = decision({
      options: [{ label: 'windowsHide plus a git cache', recommended: true, chosen: true }],
    });
    render(<DecisionsPanel decisions={[d]} />);

    const row = screen.getByText('windowsHide plus a git cache').closest('li') as HTMLElement;
    expect(within(row).getByText('recommended')).toBeInTheDocument();
    expect(within(row).getByText('chosen')).toBeInTheDocument();
  });

  it('tallies decisions by standing rather than lumping them together', () => {
    render(
      <DecisionsPanel
        decisions={[
          decision({ id: 1 }),
          decision({ id: 2, status: 'open' }),
          decision({ id: 3, status: 'reversed' }),
        ]}
      />,
    );
    expect(screen.getByText('1 decided')).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();
    expect(screen.getByText('1 reversed')).toBeInTheDocument();
  });

  it('points a superseded decision at the one that replaced it', () => {
    render(<DecisionsPanel decisions={[decision({ status: 'superseded', supersededBy: 12 })]} />);
    expect(screen.getByText(/superseded by decision #12/i)).toBeInTheDocument();
  });
});
