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

  // The layout-stability contract: once `error` is set the element is mounted
  // and STAYS mounted as `touched` flips, so the message appearing never
  // reflows the form under the user's cursor. Only its opacity changes.
  //
  // The opacity itself is deliberately NOT asserted — it is a class
  // FieldWrapper picks for itself, and jsdom loads no stylesheet, so neither
  // `toContain('opacity-0')` nor `toBeVisible()` would prove anything about
  // what a user sees. Mount-persistence is the part that is real and testable.
  it('keeps the error element mounted whether or not the field is touched', () => {
    const { rerender } = render(
      <FieldWrapper {...base} label="Title" error="Required">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    rerender(
      <FieldWrapper {...base} label="Title" error="Required" touched>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('renders without a label', () => {
    render(<FieldWrapper {...base}><input aria-label="bare" /></FieldWrapper>);
    expect(screen.getByLabelText('bare')).toBeInTheDocument();
  });
});
