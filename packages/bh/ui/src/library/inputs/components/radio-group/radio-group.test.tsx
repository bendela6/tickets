import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './radio-group';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

const THEME = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const radios = () => screen.getAllByRole<HTMLInputElement>('radio');

describe('RadioGroup', () => {
  it('reports the value of the option that was picked', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={onChange} />,
    );
    await userEvent.click(screen.getByLabelText('Compact'));
    expect(onChange).toHaveBeenCalledWith('compact');
  });

  it('groups its radios under a generated name when none is given', () => {
    render(
      <RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={() => {}} />,
    );
    const names = radios().map((radio) => radio.name);
    expect(names).toHaveLength(2);
    expect(names[0]).toBeTruthy();
    // One name across the group is the whole job of the attribute: it is what
    // makes the browser treat these two inputs as one choice.
    expect(new Set(names).size).toBe(1);
  });

  it('still takes an explicit name, for a form whose server expects a key', () => {
    render(
      <RadioGroup
        name="density"
        label="Density"
        value="comfortable"
        options={DENSITY}
        onChange={() => {}}
      />,
    );
    expect(radios().map((radio) => radio.name)).toEqual(['density', 'density']);
  });

  it('keeps two unnamed groups on one page from interfering', async () => {
    const onDensity = vi.fn();
    function TwoGroups() {
      const [theme, setTheme] = useState('light');
      return (
        <>
          <RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={onDensity} />
          <RadioGroup label="Theme" value={theme} options={THEME} onChange={setTheme} />
        </>
      );
    }
    render(<TwoGroups />);
    const density = screen.getByRole('radiogroup', { name: 'Density' });
    const theme = screen.getByRole('radiogroup', { name: 'Theme' });

    const densityName = within(density).getByLabelText<HTMLInputElement>('Comfortable').name;
    const themeName = within(theme).getByLabelText<HTMLInputElement>('Light').name;
    expect(densityName).not.toBe(themeName);

    // Two groups sharing a name would be one group: picking here would silently
    // clear the selection over there.
    await userEvent.click(within(theme).getByLabelText('Dark'));
    expect(within(theme).getByLabelText('Dark')).toBeChecked();
    expect(within(density).getByLabelText('Comfortable')).toBeChecked();
    expect(onDensity).not.toHaveBeenCalled();
  });

  it('read-only refuses the change but keeps the tab stop', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Density"
        value="comfortable"
        options={DENSITY}
        onChange={onChange}
        readOnly
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Density' })).toHaveAttribute(
      'aria-readonly',
      'true',
    );

    await userEvent.click(screen.getByLabelText('Compact'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Comfortable')).toBeChecked();
    expect(screen.getByLabelText('Compact')).not.toBeChecked();
  });

  // The reason read-only is not spelled `disabled`: a field locked by
  // permission still owes its value to the form, and still has to be reachable
  // to be read. Tabbing in from outside is the observable version of that.
  it('read-only keeps the group in the tab order', async () => {
    render(
      <>
        <button type="button">Before</button>
        <RadioGroup
          label="Density"
          value="comfortable"
          options={DENSITY}
          onChange={() => {}}
          readOnly
        />
      </>,
    );
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    expect(screen.getByLabelText('Comfortable')).toHaveFocus();
    expect(screen.getByLabelText('Comfortable')).not.toBeDisabled();
  });

  it('is neither read-only nor disabled by default', () => {
    render(
      <RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={() => {}} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Density' })).not.toHaveAttribute(
      'aria-readonly',
    );
    expect(radios().every((radio) => !radio.disabled)).toBe(true);
  });

  describe('an option with a line of description', () => {
    const ORDER = [
      { value: 'start-first', label: 'Start new first', description: 'No gap; both run a moment' },
      { value: 'stop-first', label: 'Stop old first', description: 'A short gap; one at a time' },
      { value: 'auto', label: 'Automatic' },
    ];

    it('draws the line under the label, in either variant', () => {
      for (const variant of ['plain', 'card'] as const) {
        const { unmount } = render(
          <RadioGroup
            label="Order"
            variant={variant}
            value="auto"
            options={ORDER}
            onChange={() => {}}
          />,
        );
        expect(screen.getByText('No gap; both run a moment')).toBeInTheDocument();
        unmount();
      }
    });

    it('is named by its label alone and described by the line', () => {
      // The <label> around the radio would otherwise name it by all its text,
      // and a screen reader would read the line as part of the choice's name.
      render(
        <RadioGroup
          label="Order"
          variant="card"
          value="auto"
          options={ORDER}
          onChange={() => {}}
        />,
      );
      const radio = screen.getByRole('radio', { name: 'Start new first' });
      expect(radio).toHaveAccessibleDescription('No gap; both run a moment');
      // An option with nothing to say beside it is named as before.
      expect(screen.getByRole('radio', { name: 'Automatic' })).not.toHaveAccessibleDescription();
    });

    it('still picks the option when the line is clicked', async () => {
      const onChange = vi.fn();
      render(
        <RadioGroup
          label="Order"
          variant="card"
          value="auto"
          options={ORDER}
          onChange={onChange}
        />,
      );
      await userEvent.click(screen.getByText('A short gap; one at a time'));
      expect(onChange).toHaveBeenCalledWith('stop-first');
    });

    it('gives every card in the group the same room, described or not', () => {
      const { container } = render(
        <RadioGroup
          label="Order"
          variant="card"
          value="auto"
          options={ORDER}
          onChange={() => {}}
        />,
      );
      const cards = [...container.querySelectorAll('label')];
      expect(cards.map((card) => card.className.includes('py-10'))).toEqual([true, true, true]);
    });

    it('leaves a group with no descriptions as it was', () => {
      const { container } = render(
        <RadioGroup
          label="Density"
          variant="card"
          value="compact"
          options={DENSITY}
          onChange={() => {}}
        />,
      );
      expect(container.querySelector('label')).toHaveClass('px-10', 'py-6', 'items-center');
      expect(screen.getByRole('radio', { name: 'Compact' })).not.toHaveAccessibleDescription();
    });
  });

  it('draws an option’s icon before its label, hidden from the name', () => {
    const { container } = render(
      <RadioGroup
        label="Source"
        variant="card"
        value="file"
        options={[
          { value: 'file', label: 'A file', icon: 'file' },
          { value: 'folder', label: 'A folder', icon: 'folder' },
        ]}
        onChange={() => {}}
      />,
    );
    expect(container.querySelectorAll('label svg')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'A file' })).toBeInTheDocument();
  });

  it('lays its options in a row, or in a grid of equal columns', () => {
    const { rerender } = render(
      <RadioGroup label="Density" value="compact" options={DENSITY} onChange={() => {}} />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    expect(group).toHaveClass('flex', 'items-center');
    rerender(
      <RadioGroup
        label="Density"
        layout="grid"
        value="compact"
        options={DENSITY}
        onChange={() => {}}
      />,
    );
    expect(group).toHaveClass('grid');
    // A grid's cards stretch to the tallest in their row; centring them would
    // leave each its own height.
    expect(group).not.toHaveClass('items-center');
    expect(group.className).toContain('auto-fit');
  });

  it('a disabled group disables every option, an option can disable only itself', () => {
    const { rerender } = render(
      <RadioGroup
        label="Density"
        value="comfortable"
        options={DENSITY}
        onChange={() => {}}
        disabled
      />,
    );
    expect(radios().map((radio) => radio.disabled)).toEqual([true, true]);

    rerender(
      <RadioGroup
        label="Density"
        value="comfortable"
        options={[...DENSITY, { value: 'dense', label: 'Dense', disabled: true }]}
        onChange={() => {}}
      />,
    );
    expect(radios().map((radio) => radio.disabled)).toEqual([false, false, true]);
  });
});
