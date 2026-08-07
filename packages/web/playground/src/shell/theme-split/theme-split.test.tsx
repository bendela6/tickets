import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeSplit } from './theme-split';

describe('ThemeSplit', () => {
  it('renders two panels with correct data-theme attributes', () => {
    const { container } = render(
      <ThemeSplit render={() => <div>content</div>} />
    );

    const panels = container.querySelectorAll('[data-theme]');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.getAttribute('data-theme')).toBe('light');
    expect(panels[1]?.getAttribute('data-theme')).toBe('dark');
  });

  it('renders captions for light and dark themes', () => {
    render(<ThemeSplit render={() => <div>content</div>} />);

    expect(screen.getByText('light')).toBeTruthy();
    expect(screen.getByText('dark')).toBeTruthy();
  });

  it('invokes render prop twice with correct styling', () => {
    const renderFn = vi.fn(() => <div>test-content</div>);
    render(<ThemeSplit render={renderFn} />);

    expect(renderFn).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('test-content')).toHaveLength(2);
  });

  it('applies correct CSS classes to panels', () => {
    const { container } = render(
      <ThemeSplit render={() => <div>content</div>} />
    );

    const panels = container.querySelectorAll('[data-theme]');
    panels.forEach((panel) => {
      expect(panel.className).toContain('rounded-8');
      expect(panel.className).toContain('border-1');
      expect(panel.className).toContain('border-gray-6');
      expect(panel.className).toContain('bg-gray-1');
      expect(panel.className).toContain('p-16');
    });
  });
});
