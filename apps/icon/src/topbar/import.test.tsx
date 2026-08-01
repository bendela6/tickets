import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app';

afterEach(() => vi.restoreAllMocks());

const svgFile = (name: string, text: string) =>
  new File([text], name, { type: 'image/svg+xml' });

const ICON = `<svg viewBox="0 0 24 24">
  <rect x="2" y="2" width="20" height="20" rx="4" fill="#4E46C6"/>
  <text x="4" y="16">hi</text>
</svg>`;

async function setup() {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument());
  return { user };
}

const openPopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Documents' }));
};

const objects = () => screen.getByRole('complementary', { name: 'Objects' });

/**
 * Choose a file and read the report, which is modal — everything behind it is
 * hidden from the accessibility tree while it is open, so a test that wants to
 * look at the editor has to close it first, exactly as a person would.
 */
async function pick(user: ReturnType<typeof userEvent.setup>, file: File) {
  await openPopover(user);
  await user.upload(screen.getByLabelText('Import SVG'), file);
  return screen.findByRole('dialog');
}

const done = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await user.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
};

describe('importing an SVG from the documents popover', () => {
  it('opens the file as a new document, on the artboard the file states', async () => {
    const { user } = await setup();
    await done(user, await pick(user, svgFile('wallet.svg', ICON)));

    expect(within(objects()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(screen.getByRole('banner')).getByText('wallet.icon')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('24 × 24')).toBeInTheDocument();
  });

  it('shows what it gave up, naming the element and the reason', async () => {
    const { user } = await setup();
    const dialog = await pick(user, svgFile('wallet.svg', ICON));

    expect(within(dialog).getByText('Imported wallet.svg')).toBeInTheDocument();
    const notes = within(dialog).getByRole('list', { name: 'What the import gave up' });
    expect(within(notes).getByText('text')).toBeInTheDocument();
    expect(within(notes).getByText(/not one of the shapes/)).toBeInTheDocument();
  });

  it('closes the report on Done and leaves the document open', async () => {
    const { user } = await setup();
    await done(user, await pick(user, svgFile('wallet.svg', ICON)));
    expect(within(objects()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('says why a malformed file could not be opened, and opens nothing', async () => {
    const { user } = await setup();
    await user.keyboard('r');
    // Saved first, so nothing has to be discarded to find out the file is bad.
    await user.keyboard('{Meta>}s{/Meta}');
    const dialog = await pick(user, svgFile('broken.svg', '<svg><rect></svg>'));

    expect(within(dialog).getByText('Could not import broken.svg')).toBeInTheDocument();
    expect(within(dialog).getByText(/well-formed/)).toBeInTheDocument();
    await done(user, dialog);
    // The rectangle drawn a moment ago is still the open document.
    expect(within(objects()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(screen.getByRole('banner')).getByText('untitled.icon')).toBeInTheDocument();
  });

  it('asks before discarding unsaved work, and imports nothing when refused', async () => {
    const { user } = await setup();
    const asked: string[] = [];
    vi.spyOn(window, 'confirm').mockImplementation((message?: string) => {
      asked.push(String(message));
      return false;
    });

    await user.keyboard('r');
    await openPopover(user);
    await user.upload(screen.getByLabelText('Import SVG'), svgFile('wallet.svg', ICON));

    expect(asked[0]).toContain('unsaved changes');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('untitled.icon')).toBeInTheDocument();
  });

  it('leaves the imported document saved rather than dirty', async () => {
    const { user } = await setup();
    await done(user, await pick(user, svgFile('wallet.svg', ICON)));

    await waitFor(() =>
      expect(within(screen.getByRole('banner')).getByText('saved just now')).toBeInTheDocument(),
    );
  });

  it('lists the imported document beside the one it did not replace', async () => {
    const { user } = await setup();
    await done(user, await pick(user, svgFile('wallet.svg', ICON)));
    await openPopover(user);
    const rows = within(screen.getByRole('list', { name: 'Saved documents' })).getAllByRole('button');
    expect(rows.map((row) => row.textContent).join(' ')).toContain('wallet.icon');
    expect(rows).toHaveLength(2);
  });
});
