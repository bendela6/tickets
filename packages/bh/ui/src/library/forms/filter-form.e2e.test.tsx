import {
  defineForm,
  defineRegistry,
  FilterForm,
  type FilterQuery,
  type FilterValue,
  FormProvider,
} from '@bh/form';
import { baseKinds, baseOperators, type Filter } from '@bh/resource';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import {
  type App,
  cv,
  itemsCore,
  medialib,
  sessionBoard,
  signals,
  tickets,
  walletPasses,
} from './filter-form.fixture';
import { FormButton } from './form-button';
import { baseFilter, baseInputs, baseLayouts } from './registry';

// The seven apps' filter forms, drawn with bh's own registry: set as a reader
// would, cleared, read back with a group and a locked condition, and, at a
// phone's width, applied from the sheet only on Show.

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

const operators = baseOperators;
const kinds = baseKinds;
const USERS = [
  { value: 'u1', label: 'Ana Beridze' },
  { value: 'u2', label: 'Bo Chen' },
];

type Spy = (next: FilterQuery) => void;

interface PageProps {
  app: App;
  spy: Spy;
  start?: FilterValue;
  locked?: Filter;
  countFor?: (value: FilterQuery) => Promise<number>;
}

/** A page holding the value, as the address does, and handing each new one back. */
function Page({ app, spy, start, locked, countFor }: PageProps) {
  const [value, setValue] = useState<FilterValue>(start ?? {});
  return (
    <FormProvider registry={registry}>
      <FilterForm
        form={app.form}
        value={value}
        onChange={(next) => {
          spy(next);
          setValue(next);
        }}
        meta={app.meta}
        operators={operators}
        kinds={kinds}
        optionsFor={() => Promise.resolve(USERS)}
        {...(locked ? { locked } : {})}
        {...(countFor ? { countFor } : {})}
      />
    </FormProvider>
  );
}

/** The form's own width, as it measures it. */
function width(pixels: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(pixels);
}

function draw(app: App, more: Partial<PageProps> = {}) {
  const spy = vi.fn<Spy>();
  render(<Page app={app} spy={spy} {...more} />);
  return spy;
}

/** Picks an option of a select, by the field's label. */
async function pick(label: string, option: string, within_: HTMLElement = document.body) {
  await userEvent.click(within(within_).getByRole('button', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** Types into the search and commits it with Enter. */
async function search(text: string) {
  await userEvent.type(screen.getByRole('searchbox'), `${text}{Enter}`);
}

async function clear() {
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
}

const last = (spy: ReturnType<typeof draw>) => spy.mock.lastCall?.[0];

const all = (...entries: Filter[]): FilterQuery => ({ filter: { all: entries } });

beforeEach(() => {
  width(1280);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the seven apps’ filter forms', () => {
  describe('tickets', () => {
    it('hands out the search, and Clear empties it', async () => {
      const spy = draw(tickets);
      await search('login');
      expect(last(spy)).toEqual({ search: 'login', filter: { all: [] } });
      await clear();
      expect(last(spy)).toEqual(all());
      expect(screen.getByRole('searchbox')).toHaveValue('');
    });

    it('reads back a group and a locked condition into its rules', async () => {
      const locked: Filter = { field: 'status', op: 'notEquals', value: 'done' };
      const group: Filter = {
        any: [
          { field: 'owner', op: 'isMe' },
          { field: 'due', op: 'lt', value: '2026-10-31' },
        ],
      };
      const spy = draw(tickets, { locked, start: { filter: { all: [locked, group] } } });
      const page = screen.getByRole('group', { name: 'Set by the page' });
      expect(page).toHaveTextContent(/Status\s*is not\s*Done/);
      expect(within(page).queryByRole('button', { name: /^Remove/ })).toBeNull();
      const rules = screen.getByRole('group', { name: 'Filters' });
      expect(within(rules).getByTitle(/Owner is me or Due is before/)).toBeInTheDocument();
      await search('crash');
      expect(last(spy)).toEqual({ search: 'crash', filter: { all: [locked, group] } });
      await clear();
      expect(last(spy)).toEqual(all(locked));
    });
  });

  describe('items-core', () => {
    it('hands out its presets, site and start, and Clear empties them', async () => {
      const spy = draw(itemsCore);
      await userEvent.click(screen.getByRole('button', { name: 'Running' }));
      await pick('Site', 'Docs');
      await userEvent.click(screen.getByRole('radio', { name: '7d' }));
      expect(last(spy)).toEqual(
        all(
          { field: 'status', op: 'equals', value: 'running' },
          { field: 'site', op: 'equals', value: 'docs' },
          { field: 'startedAt', op: 'inLast', value: 7 },
        ),
      );
      await clear();
      expect(last(spy)).toEqual(all());
      expect(screen.getByRole('button', { name: 'Running' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('applies its sheet at a phone’s width only on Show', async () => {
      width(375);
      const spy = draw(itemsCore);
      await userEvent.click(screen.getByRole('button', { name: 'Running' }));
      expect(last(spy)).toEqual(all({ field: 'status', op: 'equals', value: 'running' }));
      await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Filters' });
      await pick('Site', 'Shop', sheet);
      expect(spy).toHaveBeenCalledTimes(1);
      await userEvent.click(within(sheet).getByRole('button', { name: /^Show/ }));
      await waitFor(() => {
        expect(last(spy)).toEqual(
          all(
            { field: 'status', op: 'equals', value: 'running' },
            { field: 'site', op: 'equals', value: 'shop' },
          ),
        );
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.getByRole('button', { name: 'Filters, 1 filter' })).toBeInTheDocument();
    });
  });

  describe('signals', () => {
    it('hands out its selects, last seen, search and status', async () => {
      const spy = draw(signals);
      await pick('Level', 'Fatal');
      await pick('Last seen', '7 days');
      await userEvent.click(screen.getByRole('button', { name: 'Resolved' }));
      await search('timeout');
      expect(last(spy)).toEqual({
        search: 'timeout',
        filter: {
          all: [
            { field: 'level', op: 'equals', value: 'fatal' },
            { field: 'lastSeenAt', op: 'inLast', value: 7 },
            { field: 'status', op: 'equals', value: 'resolved' },
          ],
        },
      });
      await clear();
      expect(last(spy)).toEqual(all());
    });

    it('keeps a group it can’t show, and the locked condition, through a change', async () => {
      const locked: Filter = { field: 'app', op: 'equals', value: 'web' };
      const group: Filter = { not: { field: 'kind', op: 'equals', value: 'log' } };
      const spy = draw(signals, { locked, start: { filter: { all: [group] } } });
      await userEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(last(spy)).toEqual(
        all(locked, { field: 'status', op: 'equals', value: 'open' }, group),
      );
      await clear();
      expect(last(spy)).toEqual(all(locked));
    });
  });

  describe('medialib', () => {
    it('shows the field its preset asks for, and hands out what it holds', async () => {
      const spy = draw(medialib);
      await userEvent.click(screen.getByRole('radio', { name: 'Watched long ago' }));
      expect(last(spy)).toEqual(all({ field: 'watchedAt', op: 'notEmpty' }));
      await userEvent.type(screen.getByRole('spinbutton'), '30');
      expect(last(spy)).toEqual(
        all(
          { field: 'watchedAt', op: 'notEmpty' },
          { field: 'watchedAt', op: 'notInLast', value: 30 },
        ),
      );
      await userEvent.click(screen.getByRole('radio', { name: 'By person' }));
      expect(last(spy)).toEqual(all());
      await userEvent.click(await screen.findByRole('combobox', { name: 'watched by' }));
      await userEvent.click(await screen.findByRole('option', { name: /Ana Beridze/ }));
      await waitFor(() => {
        expect(last(spy)).toEqual(all({ field: 'watchedBy', op: 'in', value: ['u1'] }));
      });
      await userEvent.keyboard('{Escape}');
      await clear();
      expect(last(spy)).toEqual(all());
      expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    });
  });

  describe('cv', () => {
    it('writes its archived condition while Show archived is off', async () => {
      const spy = draw(cv);
      const archived = screen.getByRole('checkbox', { name: 'Show archived' });
      expect(archived).toBeChecked();
      await userEvent.click(archived);
      expect(last(spy)).toEqual(all({ field: 'archived', op: 'equals', value: false }));
      await search('resume');
      expect(last(spy)).toEqual({
        search: 'resume',
        filter: { all: [{ field: 'archived', op: 'equals', value: false }] },
      });
      await clear();
      expect(last(spy)).toEqual(all());
      expect(screen.getByRole('checkbox', { name: 'Show archived' })).toBeChecked();
    });
  });

  describe('wallet-passes', () => {
    it('hands out its selects, and reads back a range of days', async () => {
      const days: Filter[] = [
        { field: 'day', op: 'gte', value: '2026-10-01' },
        { field: 'day', op: 'lte', value: '2026-10-07' },
      ];
      const spy = draw(walletPasses, { start: { filter: { all: days } } });
      expect(screen.getByRole('combobox', { name: 'Days' })).toHaveTextContent(/Oct/);
      await pick('Program', 'Coffee club');
      await pick('Status', 'Active');
      expect(last(spy)).toEqual(
        all(
          { field: 'program', op: 'equals', value: 'coffee' },
          { field: 'status', op: 'equals', value: 'active' },
          ...days,
        ),
      );
      await clear();
      expect(last(spy)).toEqual(all());
    });
  });

  describe('session-board', () => {
    it('hands out its project and title', async () => {
      const spy = draw(sessionBoard);
      await pick('Project', 'bh');
      await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'login');
      expect(last(spy)).toEqual(
        all(
          { field: 'project', op: 'equals', value: 'bh' },
          { field: 'title', op: 'contains', value: 'login' },
        ),
      );
      await clear();
      expect(last(spy)).toEqual(all());
    });

    it('applies its sheet at a phone’s width only on Show, with the count it would show', async () => {
      width(375);
      const countFor = vi.fn(() => Promise.resolve(4));
      const spy = draw(sessionBoard, { countFor });
      await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
      const sheet = await screen.findByRole('dialog', { name: 'Filters' });
      await userEvent.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'db');
      expect(spy).not.toHaveBeenCalled();
      const show = await within(sheet).findByRole(
        'button',
        { name: 'Show 4 items' },
        { timeout: 2000 },
      );
      await userEvent.click(show);
      await waitFor(() => {
        expect(last(spy)).toEqual(all({ field: 'title', op: 'contains', value: 'db' }));
      });
    });
  });
});

describe('a preset and a quick field holding the same condition', () => {
  const app: App = {
    ...tickets,
    form: defineForm(registry).build((b) => {
      return [
        b.inline({}, [
          b['toggle-chips']({
            name: 'presets',
            label: 'Presets',
            config: {},
            filter: {
              presets: [{ value: 'mine', label: 'Mine', filter: { field: 'owner', op: 'isMe' } }],
            },
          }),
          b.checkbox({
            name: 'onlyMine',
            config: { label: 'Only mine' },
            filter: { field: 'owner', op: 'isMe' },
          }),
        ]),
      ];
    }) as unknown as App['form'],
  };
  const mine: Filter = { field: 'owner', op: 'isMe' };

  it('turns the quick field on and off with the preset', async () => {
    const spy = draw(app);
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(last(spy)).toEqual(all(mine));
    expect(screen.getByRole('checkbox', { name: 'Only mine' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(last(spy)).toEqual(all());
    expect(screen.getByRole('checkbox', { name: 'Only mine' })).not.toBeChecked();
  });

  it('turns the preset on and off with the quick field', async () => {
    const spy = draw(app);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Only mine' }));
    expect(last(spy)).toEqual(all(mine));
    expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Only mine' }));
    expect(last(spy)).toEqual(all());
    expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'false');
  });
});
