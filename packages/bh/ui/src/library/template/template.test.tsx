import { render, screen } from '@testing-library/react';
import type { RendererProps, TemplateField, TemplateNode } from '@bh/template';
import { describe, expect, it } from 'vitest';
import { baseRenderers } from './base-renderers';
import { baseTemplateRegistry, Template, TemplateProvider } from './template';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'size', label: 'Size', type: { kind: 'number' }, format: 'bytes' },
  { key: 'done', label: 'Done', type: { kind: 'number' } },
  { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'users' } } },
  { key: 'labels', label: 'Labels', type: { kind: 'text', many: true } },
  { key: 'note', label: 'Note', type: { kind: 'text' } },
  {
    key: 'status',
    label: 'Status',
    type: {
      kind: 'option',
      settings: {
        options: [
          { value: 'open', label: 'Open', color: 'green', order: 0 },
          { value: 'shut', label: 'Shut', order: 1 },
        ],
      },
    },
  },
];

const RECORD = {
  title: 'Repaint the hall',
  size: 13_002_342,
  done: 64,
  owner: 7,
  labels: ['paint', 'hall', 'walls', 'floor'],
  note: null,
  status: 'open',
};

function draw(template: TemplateNode, more: Partial<Parameters<typeof Template>[0]> = {}) {
  return render(<Template template={template} record={RECORD} fields={FIELDS} {...more} />);
}

describe('Template', () => {
  it("draws a part with its field's kind's renderer, in its field's format", () => {
    draw({
      layout: 'row',
      options: { gap: 2 },
      nodes: [{ field: 'title' }, { field: 'size' }, { field: 'status' }],
    });
    expect(screen.getByText('Repaint the hall')).toBeInTheDocument();
    expect(screen.getByText('12.4 MiB')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('draws the renderer and format a part names, with their options', () => {
    draw({ field: 'done', renderer: { name: 'progress', options: { max: 100 } } });
    expect(screen.getByRole('progressbar', { name: 'Done' })).toBeInTheDocument();
    draw({ value: 0.427, format: 'percent' });
    expect(screen.getByText('43%')).toBeInTheDocument();
  });

  it('fills a text template, and shows a ref by the title refOf gives', () => {
    draw(
      { layout: 'row', nodes: [{ text: '{status}: {title}' }, { field: 'owner' }] },
      { refOf: (_field, id) => (id === 7 ? { title: 'Ana Lee' } : undefined) },
    );
    expect(screen.getByText('Open: Repaint the hall')).toBeInTheDocument();
    expect(screen.getByText('Ana Lee')).toBeInTheDocument();
  });

  it('leaves out an empty part, or draws its empty text, and a node whose when fails', () => {
    const { container } = draw({
      layout: 'row',
      nodes: [
        { field: 'note' },
        { field: 'note', options: { empty: 'No note' } },
        { field: 'title', when: { field: 'status', op: 'equals', value: 'shut' } },
        { field: 'size', when: { field: 'status', op: 'equals', value: 'open' } },
      ],
    });
    expect(screen.getByText('No note')).toBeInTheDocument();
    expect(screen.queryByText('Repaint the hall')).toBeNull();
    expect(screen.getByText('12.4 MiB')).toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('draws nothing for a layout whose nodes all show nothing', () => {
    const { container } = draw({ layout: 'row', nodes: [{ field: 'note' }] });
    expect(container).toBeEmptyDOMElement();
  });

  it('repeats its nodes once per entry of a list field, up to max, then counts the rest', () => {
    draw({ layout: 'repeat', options: { field: 'labels', max: 2 }, nodes: [{ field: 'labels' }] });
    expect(screen.getByText('paint')).toBeInTheDocument();
    expect(screen.getByText('hall')).toBeInTheDocument();
    expect(screen.queryByText('walls')).toBeNull();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('leaves out a part whose renderer needs more room than the host has', () => {
    draw(
      { layout: 'row', nodes: [{ field: 'title' }, { field: 'done', renderer: 'meter' }] },
      { width: 60 },
    );
    expect(screen.getByText('Repaint the hall')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
    draw({ field: 'done', renderer: 'meter' }, { width: 120 });
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('draws a placeholder in each part’s line while the record loads', () => {
    const { container } = render(
      <Template
        template={{ layout: 'row', nodes: [{ field: 'title' }, { field: 'size' }] }}
        fields={FIELDS}
      />,
    );
    expect(container.querySelectorAll('[aria-hidden="true"].animate-pulse')).toHaveLength(2);
    expect(screen.queryByText('Repaint the hall')).toBeNull();
  });

  it('takes nothing down for a stored mistake: an unknown renderer draws text, an unknown layout a row', () => {
    draw({
      layout: 'nowhere',
      nodes: [{ field: 'title', renderer: 'nothing' }],
    } as unknown as TemplateNode);
    expect(screen.getByText('Repaint the hall')).toBeInTheDocument();
  });

  it("draws with the provider's registry, an app's renderer beside bh's", () => {
    function Shout({ values }: RendererProps) {
      return <b>{values.map((shown) => shown.text.toUpperCase()).join(' ')}</b>;
    }
    const registry = {
      ...baseTemplateRegistry,
      renderers: baseRenderers.register({
        shout: baseRenderers.define({ kinds: 'any', Component: Shout }),
      }),
    };
    render(
      <TemplateProvider registry={registry}>
        <Template
          template={{ field: 'title', renderer: 'shout' }}
          record={RECORD}
          fields={FIELDS}
        />
      </TemplateProvider>,
    );
    expect(screen.getByText('REPAINT THE HALL')).toBeInTheDocument();
  });
});
