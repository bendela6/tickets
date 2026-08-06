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

  // `touched` is part of the engine's FieldWrapperProps but no longer gates
  // anything here: the error is mounted and visible as soon as `error` is
  // set, regardless of `touched`. This pins that `touched` flipping causes no
  // change — the error was visible before the rerender and stays visible
  // after it.
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

// Design file 20: "labels go left only at >=520px container width — a 104px
// label column plus a usable field needs that much. Below it, labels go on top."
describe('FieldWrapper places its label by container width', () => {
  it('establishes the container the label rules query', () => {
    // The rule is a container query, so it needs a container, and an element
    // cannot query the one it establishes. If this wrapper ever disappears every
    // `@form-labels:*` class below becomes inert — with no error, no warning and
    // no visual clue beyond labels that never move.
    const { container } = render(
      <FieldWrapper {...base} label="Title">
        <input id="title" />
      </FieldWrapper>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('@container');
  });

  it('carries the label column at the ladder width, not a bare number', () => {
    const { container } = render(
      <FieldWrapper {...base} label="Title">
        <input id="title" />
      </FieldWrapper>,
    );
    const labelBox = container.querySelector('[class*="w-104"]');
    expect(labelBox).not.toBeNull();
    expect(labelBox?.className).toContain('@form-labels:shrink-0');
  });

  it('reserves the label column even with no label, so controls stay aligned', () => {
    // Without this an unlabelled field starts 104px to the left of every
    // labelled sibling, which reads as a broken form rather than a deliberate
    // one. Caught by rendering a form whose last field had no caption.
    const { container } = render(
      <FieldWrapper {...base}>
        <input id="title" />
      </FieldWrapper>,
    );
    const spacer = container.querySelector('[class*="w-104"]');
    expect(spacer).not.toBeNull();
    expect(spacer?.className).toContain('hidden');
    expect(spacer?.className).toContain('@form-labels:block');
  });

  it('does not depend on the form root, which is optional in the registry', () => {
    // `root` is `root?:` in FormRegistry. Anchoring the container there would
    // have made every label rule vanish, silently, for any consumer that omits
    // the slot — the gallery's own demo omits it, which is how this was found.
    const { container } = render(
      <FieldWrapper {...base} label="Title">
        <input id="title" />
      </FieldWrapper>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('@container');
  });
});
