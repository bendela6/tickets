import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenState } from './screen-state';

describe('ScreenState', () => {
  it('renders the required title', () => {
    render(<ScreenState title="Couldn't load issues" />);
    expect(screen.getByText("Couldn't load issues")).toBeTruthy();
  });

  it('renders no icon disc when icon is unset', () => {
    const { container } = render(<ScreenState title="No agents yet" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders an icon disc when icon is set, sized 14px', () => {
    render(<ScreenState title="Couldn't load issues" icon="triangle-alert" />);
    const svg = document.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('14');
  });

  it('tone="danger" puts the danger subtle classes on the icon disc', () => {
    render(<ScreenState title="Couldn't load issues" icon="triangle-alert" tone="danger" />);
    const disc = document.querySelector('svg')!.parentElement!;
    expect(disc.className).toContain('bg-red-3');
    expect(disc.className).toContain('text-red-11');
  });

  it('defaults to the neutral tone when unset', () => {
    render(<ScreenState title="No agents yet" icon="circle" />);
    const disc = document.querySelector('svg')!.parentElement!;
    expect(disc.className).toContain('bg-gray-3');
    expect(disc.className).toContain('text-gray-11');
  });

  it('renders body content when set', () => {
    render(<ScreenState title="No activity yet" body="Logs and events will show up here." />);
    expect(screen.getByText('Logs and events will show up here.')).toBeTruthy();
  });

  it('renders no body element when body is unset', () => {
    render(<ScreenState title="No activity yet" />);
    expect(screen.getByText('No activity yet').parentElement!.children.length).toBe(1);
  });

  it('renders a numeric 0 body instead of swallowing it', () => {
    render(<ScreenState title="Occurrences" body={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders action content when set', () => {
    render(<ScreenState title="Couldn't load issues" action={<button type="button">Retry</button>} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('renders a numeric 0 action instead of swallowing it', () => {
    render(<ScreenState title="Count" action={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders no action wrapper when action is unset', () => {
    render(<ScreenState title="No activity yet" />);
    expect(screen.getByText('No activity yet').parentElement!.children.length).toBe(1);
  });

  it('merges an extra className onto the outer wrapper', () => {
    const { container } = render(<ScreenState title="No agents yet" className="max-w-460" />);
    expect(container.firstElementChild!.className).toContain('max-w-460');
  });

  it('renders title as a ReactNode, not just a string', () => {
    render(<ScreenState title={<span data-testid="fancy-title">Fancy</span>} />);
    expect(screen.getByTestId('fancy-title')).toBeTruthy();
  });
});
