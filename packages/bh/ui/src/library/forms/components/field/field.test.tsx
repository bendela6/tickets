import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../../../inputs/components/input';
import { Field } from './field';

describe('Field, with an id', () => {
  it('labels the control whose id it is given', () => {
    render(
      <Field id="name" label="Name">
        <input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('marks a required field in the label', () => {
    render(
      <Field id="name" label="Name" required>
        <input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
  });

  it('puts the hint under the control and describes the control by it', () => {
    render(
      <Field id="name" label="Name" hint="Its files are named after it.">
        <input id="name" />
      </Field>,
    );
    const control = screen.getByLabelText('Name');
    expect(control).toHaveAccessibleDescription('Its files are named after it.');
    // At an id made from the control's, for a control further down to name.
    expect(control).toHaveAttribute('aria-describedby', 'name-hint');
  });

  it('describes one of the library’s controls the same way', () => {
    render(
      <Field id="name" label="Name" hint="Its files are named after it.">
        <Input id="name" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Its files are named after it.',
    );
  });

  it('keeps the control’s own description, and names each id once', () => {
    render(
      <>
        <p id="rules">Up to 24 letters.</p>
        <Field id="name" label="Name" hint="Its files are named after it.">
          <input id="name" aria-describedby="rules name-hint" />
        </Field>
      </>,
    );
    const control = screen.getByLabelText('Name');
    expect(control).toHaveAttribute('aria-describedby', 'rules name-hint');
    expect(control).toHaveAccessibleDescription('Up to 24 letters. Its files are named after it.');
  });

  it('leaves a control further down to point at the ids itself', () => {
    // The field's child here is a row, not the control the label names, so
    // nothing is added to it; the control names `<id>-hint` on its own.
    render(
      <Field id="port" label="Port" hint="Between 1 and 65535.">
        <div data-testid="row">
          <input id="port" aria-describedby="port-hint" />
        </div>
      </Field>,
    );
    expect(screen.getByTestId('row')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Port')).toHaveAccessibleDescription('Between 1 and 65535.');
  });

  it('takes any node as its hint, a link in it say', () => {
    render(
      <Field
        id="name"
        label="Name"
        hint={
          <>
            See <a href="#rules">the rules</a>.
          </>
        }
      >
        <input id="name" />
      </Field>,
    );
    expect(screen.getByRole('link', { name: 'the rules' })).toBeInTheDocument();
  });

  it('shows the error in the hint’s place, as an alert the control is described by', () => {
    const { rerender } = render(
      <Field id="name" label="Name" hint="Its files are named after it.">
        <input id="name" />
      </Field>,
    );
    rerender(
      <Field id="name" label="Name" hint="Its files are named after it." error="Use letters only">
        <input id="name" />
      </Field>,
    );
    expect(screen.queryByText('Its files are named after it.')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Use letters only');
    const control = screen.getByLabelText('Name');
    expect(control).toHaveAccessibleDescription('Use letters only');
    expect(control).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('describes the control by nothing with neither a hint nor an error', () => {
    render(
      <Field id="name" label="Name">
        <input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });

  it('draws nothing under the control with neither a hint nor an error', () => {
    const { container } = render(
      <Field id="name" label="Name">
        <input id="name" />
      </Field>,
    );
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('keeps the className a form gives it, for a width of its own', () => {
    const { container } = render(
      <Field id="port" label="Port" className="w-120">
        <input id="port" />
      </Field>,
    );
    expect(container.firstElementChild).toHaveClass('w-120', 'flex-col');
  });
});

describe('Field, without an id', () => {
  it('names the group of controls it holds by its caption', () => {
    const { container } = render(
      <Field label="Size">
        <input aria-label="Width" />
        <input aria-label="Height" />
      </Field>,
    );
    const group = screen.getByRole('group', { name: 'Size' });
    expect(group).toContainElement(screen.getByLabelText('Width'));
    // A <label> would name one control; the caption names the group alone.
    expect(container.querySelector('label')).toBeNull();
  });

  it('describes the group by its hint, then by its error', () => {
    const { rerender } = render(
      <Field label="Size" hint="In pixels.">
        <input aria-label="Width" />
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Size' })).toHaveAccessibleDescription('In pixels.');
    rerender(
      <Field label="Size" hint="In pixels." error="Both are needed">
        <input aria-label="Width" />
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Size' })).toHaveAccessibleDescription(
      'Both are needed',
    );
  });

  it('marks a required group in its caption', () => {
    render(
      <Field label="Size" required>
        <input aria-label="Width" />
      </Field>,
    );
    // The name ends in the asterisk, as a required label's does. Named
    // through aria-labelledby, jsdom drops the space before it.
    expect(screen.getByRole('group', { name: /^Size ?\*$/ })).toBeInTheDocument();
  });

  it('keeps two groups’ ids apart', () => {
    render(
      <>
        <Field label="Size" hint="In pixels.">
          <input aria-label="Width" />
        </Field>
        <Field label="Margin" hint="In steps of 4.">
          <input aria-label="Top" />
        </Field>
      </>,
    );
    expect(screen.getByRole('group', { name: 'Size' })).toHaveAccessibleDescription('In pixels.');
    expect(screen.getByRole('group', { name: 'Margin' })).toHaveAccessibleDescription(
      'In steps of 4.',
    );
  });
});
