import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

describe('form layouts', () => {
  it('CardLayout renders its title and children inside a card', () => {
    render(
      <CardLayout props={{ title: 'Details' }}>
        <span>field</span>
      </CardLayout>,
    );
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('CardLayout renders a description under the title', () => {
    render(
      <CardLayout props={{ title: 'Details', description: 'Who and when' }}>
        <span>field</span>
      </CardLayout>,
    );
    expect(screen.getByText('Who and when')).toBeInTheDocument();
  });

  it('CardLayout omits the header entirely when given no title or description', () => {
    render(<CardLayout props={{}}><span>field</span></CardLayout>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('GroupLayout renders its title and children', () => {
    render(
      <GroupLayout props={{ title: 'Advanced' }}>
        <span>field</span>
      </GroupLayout>,
    );
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('GroupLayout omits its header when given neither title nor description', () => {
    render(<GroupLayout props={{}}><span>field</span></GroupLayout>);
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('RowLayout renders its children', () => {
    render(<RowLayout props={{}}><span>a</span><span>b</span></RowLayout>);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('ColumnLayout renders its children', () => {
    render(<ColumnLayout props={{}}><span>a</span><span>b</span></ColumnLayout>);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  // Design file 20: "two columns only past ~760px — otherwise the pairs are too
  // narrow to hold a date beside a duration."
  describe('RowLayout pairs its fields only once there is room', () => {
    it('stacks by default and goes side by side at the form-columns width', () => {
      const { container } = render(
        <RowLayout props={{}}><span>a</span><span>b</span></RowLayout>,
      );
      const row = container.querySelector('[class*="form-columns"]') as HTMLElement;

      // `Row` renders `flex-row` in its base; this className says `flex-col`.
      // They are the same CSS property, so which wins is decided by twMerge and
      // NOT by class order — a browser would pick whichever Tailwind emitted
      // later regardless of how they are written here. Asserting the merged
      // output is the only way to know the narrow case actually stacks.
      expect(row.className).toContain('flex-col');
      expect(row.className).not.toMatch(/(^|\s)flex-row(\s|$)/);
      expect(row.className).toContain('@form-columns:flex-row');
    });

    it('establishes the container it queries', () => {
      // A container query needs a container, and an element cannot query the one
      // it establishes — hence the wrapper. Without it every rule below is inert
      // and nothing anywhere reports an error.
      const { container } = render(
        <RowLayout props={{}}><span>a</span></RowLayout>,
      );
      expect((container.firstElementChild as HTMLElement).className).toContain('@container');
    });
  });
});
