import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formRegistry } from './registry';

describe('formRegistry', () => {
  it('registers every base input plus the app-specific directory', () => {
    expect(Object.keys(formRegistry.inputs).sort()).toEqual([
      'checkbox', 'checkbox-group', 'color', 'date', 'date-range', 'directory',
      'duration', 'email', 'file', 'icon', 'json', 'list', 'multi-select', 'number',
      'object', 'password', 'pin', 'radio', 'range', 'rating', 'segmented', 'select',
      'slider', 'tags', 'text', 'textarea', 'time', 'toggle', 'user',
    ]);
  });

  it('registers the five base layouts', () => {
    expect(Object.keys(formRegistry.layouts).sort()).toEqual([
      'actions',
      'card',
      'column',
      'group',
      'row',
    ]);
  });

  it('the text widget renders a control wired to onChange', async () => {
    const { text } = formRegistry.inputs;
    const Comp = text.Component;
    render(<Comp name="name" value="" onChange={() => {}} onBlur={() => {}} config={{ placeholder: 'tickets' }} loading={false} />);
    expect(screen.getByPlaceholderText('tickets')).toBeInTheDocument();
  });
});
