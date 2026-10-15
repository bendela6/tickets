import { act, isInaccessible, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    const svg = document.querySelector('svg');
    if (!svg) {
      throw new Error("document.querySelector('svg') matched nothing");
    }
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('14');
  });

  it('tone="danger" puts the danger subtle classes on the icon disc', () => {
    render(<ScreenState title="Couldn't load issues" icon="triangle-alert" tone="danger" />);
    const disc = document.querySelector('svg')?.parentElement;
    if (!disc) {
      throw new Error('the screen state rendered no icon disc');
    }
    expect(disc.className).toContain('bg-red-3');
    expect(disc.className).toContain('text-red-11');
  });

  it('defaults to the neutral tone when unset', () => {
    render(<ScreenState title="No agents yet" icon="circle" />);
    const disc = document.querySelector('svg')?.parentElement;
    if (!disc) {
      throw new Error('the screen state rendered no icon disc');
    }
    expect(disc.className).toContain('bg-gray-3');
    expect(disc.className).toContain('text-gray-11');
  });

  it('renders body content when set', () => {
    render(<ScreenState title="No activity yet" body="Logs and events will show up here." />);
    expect(screen.getByText('Logs and events will show up here.')).toBeTruthy();
  });

  it('renders no body element when body is unset', () => {
    render(<ScreenState title="No activity yet" />);
    expect(screen.getByText('No activity yet').parentElement?.children.length).toBe(1);
  });

  it('renders a numeric 0 body instead of swallowing it', () => {
    render(<ScreenState title="Occurrences" body={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders action content when set', () => {
    render(
      <ScreenState title="Couldn't load issues" action={<button type="button">Retry</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('renders a numeric 0 action instead of swallowing it', () => {
    render(<ScreenState title="Count" action={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders no action wrapper when action is unset', () => {
    render(<ScreenState title="No activity yet" />);
    expect(screen.getByText('No activity yet').parentElement?.children.length).toBe(1);
  });

  it('merges an extra className onto the outer wrapper', () => {
    const { container } = render(<ScreenState title="No agents yet" className="max-w-460" />);
    expect(container.firstElementChild?.className).toContain('max-w-460');
  });

  it('renders title as a ReactNode, not just a string', () => {
    render(<ScreenState title={<span data-testid="fancy-title">Fancy</span>} />);
    expect(screen.getByTestId('fancy-title')).toBeTruthy();
  });
});

// The loading state, as a screen reader and a sighted reader meet it: nothing
// reachable until the delay is up, then its words in a status region, in a
// block marked busy.
describe('ScreenState state="loading"', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Lets `ms` pass, as the screen would. */
  function wait(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('says "Loading…" in a status region once the delay is up', () => {
    render(<ScreenState state="loading" />);
    wait(400);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading…');
    expect(isInaccessible(screen.getByText('Loading…'))).toBe(false);
  });

  it('keeps its words from assistive tech until the delay is up, so a fast load says nothing', () => {
    render(<ScreenState state="loading" title="Loading the files…" />);
    // The region is there from the start, so the words arrive into it.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(isInaccessible(screen.getByText('Loading the files…'))).toBe(true);
    wait(399);
    expect(isInaccessible(screen.getByText('Loading the files…'))).toBe(true);
    wait(1);
    expect(isInaccessible(screen.getByText('Loading the files…'))).toBe(false);
  });

  it('waits as long as its delay says', () => {
    render(<ScreenState state="loading" delay={1000} />);
    wait(999);
    expect(isInaccessible(screen.getByText('Loading…'))).toBe(true);
    wait(1);
    expect(isInaccessible(screen.getByText('Loading…'))).toBe(false);
  });

  it('shows at once with a delay of 0', () => {
    render(<ScreenState state="loading" delay={0} />);
    expect(isInaccessible(screen.getByText('Loading…'))).toBe(false);
  });

  it('stays shown once the delay is up, whatever the delay becomes', () => {
    const { rerender } = render(<ScreenState state="loading" />);
    wait(400);
    rerender(<ScreenState state="loading" delay={5000} />);
    expect(isInaccessible(screen.getByText('Loading…'))).toBe(false);
  });

  it('marks the block busy while it stands in for the content', () => {
    render(<ScreenState state="loading" delay={0} />);
    const busy = screen.getByRole('generic', { busy: true });
    expect(busy).toContainElement(screen.getByRole('status'));
  });

  it('reads its title and body from the status region, and leaves the spinner unnamed', () => {
    render(
      <ScreenState
        state="loading"
        delay={0}
        title="Loading the files…"
        body="A large folder takes a few seconds."
      />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading the files…');
    expect(status).toHaveTextContent('A large folder takes a few seconds.');
    // The title says what is loading; a spinner named "Loading" would say it twice.
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows its action once the delay is up', () => {
    render(
      <ScreenState state="loading" delay={0} action={<button type="button">Cancel</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders a numeric 0 body instead of swallowing it', () => {
    render(<ScreenState state="loading" delay={0} body={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('0');
  });

  it('merges an extra className onto the outer block', () => {
    render(<ScreenState state="loading" delay={0} className="min-h-200" />);
    expect(screen.getByRole('generic', { busy: true }).className).toContain('min-h-200');
  });

  it('is gone with its status region when the content arrives', () => {
    const { rerender } = render(<ScreenState state="loading" delay={0} />);
    rerender(<ScreenState icon="search" title="No files yet" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('generic', { busy: true })).toBeNull();
    expect(screen.getByText('No files yet')).toBeInTheDocument();
  });

  it('is no live region and not busy when it says what happened', () => {
    render(<ScreenState tone="danger" icon="triangle-alert" title="Couldn't load the files" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('generic', { busy: true })).toBeNull();
  });

  it('takes no icon while loading, and needs a title otherwise', () => {
    // The spinner is the loading state's mark.
    // @ts-expect-error — `icon` is never while loading
    render(<ScreenState state="loading" icon="search" delay={0} />);
    // A message has to say what happened.
    // @ts-expect-error — `title` is required unless loading
    render(<ScreenState icon="search" />);
    // A delay only means something while loading.
    // @ts-expect-error — `delay` is never unless loading
    render(<ScreenState title="No files yet" delay={0} />);
    expect(screen.getAllByText('Loading…')).toHaveLength(1);
  });
});
