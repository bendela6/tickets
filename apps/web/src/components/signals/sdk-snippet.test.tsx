import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { SdkSnippet } from './sdk-snippet';

const DSN = 'sgl://pub_4f9c21ab@127.0.0.1:4180/3';

test('renders the node init snippet with the dsn verbatim', () => {
  render(<SdkSnippet dsn={DSN} platform="node" />);
  expect(screen.getByText(/@bendela6\/signals-node/)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(DSN.replace(/[/@:.]/g, '\\$&')))).toBeInTheDocument();
});

test('toggling to browser shows the <script> tag form calling Signals.initSignals with the dsn', async () => {
  const user = userEvent.setup();
  render(<SdkSnippet dsn={DSN} platform="node" />);

  await user.click(screen.getByRole('button', { name: /^browser$/i }));

  // The browser bundle exposes `window.Signals = { initSignals, getClient }`
  // (see packages/signals/browser/src/auto.ts) — there is no `Signals.init`.
  // Match `Signals.initSignals(` specifically so a regression back to the
  // nonexistent `Signals.init(` (which `/Signals\.init/` would also match)
  // fails this test.
  expect(screen.getByText(/Signals\.initSignals\(/)).toBeInTheDocument();
  expect(screen.queryByText(/Signals\.init\(/)).not.toBeInTheDocument();
  expect(screen.getByText(new RegExp(DSN.replace(/[/@:.]/g, '\\$&')))).toBeInTheDocument();
});

test('toggling to react shows the react import', async () => {
  const user = userEvent.setup();
  render(<SdkSnippet dsn={DSN} platform="node" />);

  await user.click(screen.getByRole('button', { name: /^react$/i }));

  expect(screen.getByText(/@bendela6\/signals-react/)).toBeInTheDocument();
  expect(screen.getByText(/SignalsErrorBoundary/)).toBeInTheDocument();
});

test('the platform prop selects the initially active snippet', () => {
  render(<SdkSnippet dsn={DSN} platform="react" />);
  expect(screen.getByText(/@bendela6\/signals-react/)).toBeInTheDocument();
});
