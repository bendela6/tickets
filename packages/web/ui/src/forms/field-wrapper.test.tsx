import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldWrapper } from './field-wrapper';

const base = { name: 'title', required: false, touched: false, loading: false };

describe('FieldWrapper', () => {
  it('labels the control it wraps', () => {
    render(
      <FieldWrapper {...base} label="Title">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('marks a required field', () => {
    render(
      <FieldWrapper {...base} label="Title" required>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows the description when there is no error', () => {
    render(
      <FieldWrapper {...base} label="Title" description="Keep it short">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByText('Keep it short')).toBeInTheDocument();
  });

  it('replaces the description with the error once one exists', () => {
    render(
      <FieldWrapper {...base} label="Title" description="Keep it short" error="Required" touched>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.queryByText('Keep it short')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  // The error element stays mounted and only its opacity changes, so a message
  // appearing does not push the rest of the form down.
  it('keeps the error line in the tree but invisible until the field is touched', () => {
    const { rerender } = render(
      <FieldWrapper {...base} label="Title" error="Required">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert', { hidden: true }).className).toContain('opacity-0');
    rerender(
      <FieldWrapper {...base} label="Title" error="Required" touched>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert').className).toContain('opacity-100');
  });

  it('renders without a label', () => {
    render(<FieldWrapper {...base}><input aria-label="bare" /></FieldWrapper>);
    expect(screen.getByLabelText('bare')).toBeInTheDocument();
  });
});
