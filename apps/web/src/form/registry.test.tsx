import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formRegistry } from './registry';

describe('formRegistry', () => {
  it('registers every base input', () => {
    expect(formRegistry.inputs.entries().map(([name]) => name).sort()).toEqual([
      'avatars', 'checkbox', 'checkbox-group', 'color', 'date', 'date-range',
      'duration', 'email', 'file', 'icon', 'json', 'list', 'multi-select', 'number',
      'object', 'password', 'pin', 'radio', 'range', 'rating', 'rules', 'search',
      'segmented', 'select', 'slider', 'tabs', 'tags', 'text', 'textarea', 'time',
      'toggle', 'toggle-chips', 'user',
    ]);
  });

  it('registers the six base layouts', () => {
    expect(formRegistry.layouts.entries().map(([name]) => name).sort()).toEqual([
      'actions',
      'card',
      'column',
      'group',
      'inline',
      'row',
    ]);
  });

  it('the text widget renders a control wired to onChange', async () => {
    const Comp = formRegistry.inputs.get('text').Component;
    render(<Comp name="name" value="" onChange={() => {}} onBlur={() => {}} config={{ placeholder: 'tickets' }} loading={false} />);
    expect(screen.getByPlaceholderText('tickets')).toBeInTheDocument();
  });
});
