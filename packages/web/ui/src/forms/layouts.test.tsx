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
});
