import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContextMeter } from './context-meter';

describe('ContextMeter', () => {
  it('renders nothing until there is a context reading', () => {
    const { container } = render(
      <ContextMeter contextTokens={null} contextWindow={200_000} tokensOut={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows context fill and tokens out', () => {
    render(<ContextMeter contextTokens={72_000} contextWindow={200_000} tokensOut={148_000} />);
    expect(screen.getByText('72k / 200k')).toBeInTheDocument();
    expect(screen.getByText('148k')).toBeInTheDocument();
  });

  it('marks the fill as over budget near the window', () => {
    render(<ContextMeter contextTokens={195_000} contextWindow={200_000} tokensOut={0} />);
    expect(screen.getByTestId('context-fill').className).toContain('text-red-9');
  });
});
