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

const radios = () => screen.getAllByRole('radio') as HTMLInputElement[];

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
    render(<RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={() => {}} />);
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

    const densityName = (within(density).getByLabelText('Comfortable') as HTMLInputElement).name;
    const themeName = (within(theme).getByLabelText('Light') as HTMLInputElement).name;
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
    render(<RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Density' })).not.toHaveAttribute('aria-readonly');
    expect(radios().every((radio) => !radio.disabled)).toBe(true);
  });

  it('a disabled group disables every option, an option can disable only itself', () => {
    const { rerender } = render(
      <RadioGroup label="Density" value="comfortable" options={DENSITY} onChange={() => {}} disabled />,
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
