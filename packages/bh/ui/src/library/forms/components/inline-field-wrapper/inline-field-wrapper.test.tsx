import { defineForm, defineRegistry, Form } from '@bh/form';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Input } from '../../../inputs/components/input';
import type { ControlProps } from '../../../inputs/contract';
import { baseInputs, baseLayouts } from '../../registry';
import { FieldWrapper } from '../field-wrapper';
import { InlineFieldWrapper } from './inline-field-wrapper';
import { useInlineField } from './inline-field';

const base = { required: false, touched: false, loading: false };

/** A text box that holds what it's given, for a wrapper to wrap. */
function Box(props: Partial<ControlProps<string>> & { 'aria-describedby'?: string }) {
  return <Input value="" onChange={() => {}} {...props} />;
}

function wrap(props: Partial<Parameters<typeof InlineFieldWrapper>[0]>, children: ReactNode) {
  return render(
    <InlineFieldWrapper name="days" {...base} {...props}>
      {children}
    </InlineFieldWrapper>,
  );
}

describe('InlineFieldWrapper', () => {
  it('draws the label as a muted prefix before a control with no room for it inside', () => {
    wrap({ type: 'number', label: 'Updated in the last' }, <Box id="days" value="7" />);
    const label = screen.getByText('Updated in the last');
    expect(label).not.toHaveClass('sr-only');
    expect(label).toHaveClass('text-gray-11');
    expect(screen.getByRole('textbox', { name: 'Updated in the last' })).toBeInTheDocument();
  });

  it('names a control whose options say what it is for a screen reader only', () => {
    wrap({ name: 'q', type: 'search', label: 'Search' }, <Box id="q" value="" />);
    expect(screen.getByText('Search')).toHaveClass('sr-only');
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('lets a search box grow from 160 pixels to fill the row', () => {
    const { container } = wrap({ name: 'q', type: 'search', label: 'Search' }, <Box id="q" />);
    expect(container.firstElementChild).toHaveClass('min-w-160', 'flex-1');
  });

  it('shows a problem beside the control, which is described by it', () => {
    wrap(
      { label: 'Days', error: 'At most 366 days.', errorId: 'days-error' },
      <Box id="days" value="400" tone="danger" aria-describedby="days-error" />,
    );
    const days = screen.getByRole('textbox', { name: 'Days' });
    expect(days).toHaveAccessibleDescription('At most 366 days.');
    expect(days).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('At most 366 days.')).toBeVisible();
  });

  it('shows a config that failed to load before the field’s own problem', () => {
    wrap(
      { label: 'Days', error: 'Too many', configError: new Error('No days today'), errorId: 'e' },
      <Box id="days" />,
    );
    expect(screen.getByText('No days today')).toBeInTheDocument();
    expect(screen.queryByText('Too many')).toBeNull();
  });

  it('reads the description without showing it', () => {
    wrap(
      { label: 'Days', description: 'Counted back from today', descriptionId: 'days-help' },
      <Box id="days" aria-describedby="days-help" />,
    );
    expect(screen.getByRole('textbox', { name: 'Days' })).toHaveAccessibleDescription(
      'Counted back from today',
    );
    expect(screen.getByText('Counted back from today')).toHaveClass('sr-only');
  });

  it('shows a small spinner while a commit is saved', () => {
    wrap({ label: 'Days', saving: true }, <Box id="days" />);
    expect(screen.getByRole('status')).toContainElement(
      screen.getByRole('img', { name: 'Saving' }),
    );
  });

  it('leaves a checkbox’s label to the box, as the text beside it', () => {
    function Probe() {
      const inline = useInlineField();
      return <span data-testid="probe">{inline?.label ?? 'none'}</span>;
    }
    wrap({ name: 'mine', type: 'checkbox', label: 'Only mine' }, <Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('Only mine');
    expect(document.querySelector('label')).toBeNull();
  });

  it('tells its control the row’s size, and no label for a kind that doesn’t draw it inside', () => {
    function Probe() {
      const inline = useInlineField();
      return <span data-testid="probe">{`${inline?.label ?? 'none'} ${inline?.size}`}</span>;
    }
    wrap({ type: 'number', label: 'Days' }, <Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('none xs');
  });
});

describe('the inline layout', () => {
  const registry = defineRegistry({
    inputs: baseInputs,
    layouts: baseLayouts,
    field: { Component: FieldWrapper },
  });

  it('lays its fields in a row that wraps, each named by InlineFieldWrapper', () => {
    const form = defineForm(registry).build((b) => {
      return [
        b.inline({ overflow: 'wrap' }, [
          b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
          b.number({ name: 'days', label: 'Updated in the last', config: { suffix: 'days' } }),
        ]),
      ];
    });
    render(<Form registry={registry} form={form} />);
    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(screen.getByText('Search')).toHaveClass('sr-only');
    expect(screen.getByText('Updated in the last')).not.toHaveClass('sr-only');
    const row = search.closest('.flex-wrap');
    expect(row).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-6');
    expect(row).toContainElement(screen.getByRole('spinbutton', { name: 'Updated in the last' }));
  });
});
