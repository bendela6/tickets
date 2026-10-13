import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Figure, Figures, Num } from './figures';

describe('Figure', () => {
  it('lays out the label, the note and the value in that order', () => {
    const { container } = render(<Figure label="Images" note="12 of 30 in use" value="4.2 GB" />);
    expect(container.firstElementChild?.textContent).toBe('Images12 of 30 in use4.2 GB');
  });

  // The note is the part that gives way; its tooltip keeps what it cut.
  it('truncates the note, with the whole of it as its tooltip', () => {
    render(<Figure label="Images" note="12 of 30 in use" value="4.2 GB" />);
    const note = screen.getByText('12 of 30 in use');
    expect(note).toHaveAttribute('title', '12 of 30 in use');
    expect(note.className).toContain('truncate');
  });

  it('sets the value in mono, the figures a column lines up by', () => {
    render(<Figure label="Images" value="4.2 GB" />);
    for (const cls of ['font-mono', 'tabular-nums', 'shrink-0']) {
      expect(screen.getByText('4.2 GB').className).toContain(cls);
    }
  });

  it('takes rich content as the label and the value', () => {
    render(<Figure label={<strong>Names</strong>} value={<span>3 up</span>} />);
    expect(screen.getByText('Names').tagName).toBe('STRONG');
    expect(screen.getByText('3 up')).toBeInTheDocument();
  });
});

describe('Figures', () => {
  it('lists its rows with no caption when given no title', () => {
    const { container } = render(
      <Figures>
        <Figure label="Images" value="4.2 GB" />
        <Figure label="Volumes" value="0 B" />
      </Figures>,
    );
    const list = container.firstElementChild;
    expect(list?.children).toHaveLength(2);
    expect(list?.className).toContain('divide-y-1');
  });

  // The caption is SectionHeader's, so it is the uppercase every section has.
  it('captions the rows with a SectionHeader', () => {
    render(
      <Figures title="Most memory">
        <Figure label="Images" value="4.2 GB" />
      </Figures>,
    );
    const caption = screen.getByText('Most memory');
    expect(caption.className).toContain('uppercase');
    expect(caption.className).toContain('tracking-wider');
  });
});

describe('Num', () => {
  it('sets a number in running text in mono', () => {
    render(
      <p>
        <Num>6.1 GB</Num> used
      </p>,
    );
    const num = screen.getByText('6.1 GB');
    expect(num.tagName).toBe('SPAN');
    expect(num.className).toContain('tabular-nums');
  });
});
