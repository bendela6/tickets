import { createRegistry, toExample } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';
import { apiBlock } from '.';

const registry = createRegistry(markdownBlocks);
const doc = (lines: string[]) => ['```api', ...lines, '```'].join('\n');

const mixed = doc([
  'resource: jobs',
  'routes:',
  '  - { method: GET, path: /jobs, summary: List every job. }',
  '  - method: POST',
  '    path: /jobs/:id/pause',
  '    summary: Pauses a running job.',
  '    params:',
  '      - { name: id, in: path, type: uuid, required: true }',
  '    responses:',
  '      - { status: 409, description: job is not running }',
]);

const routes = () => screen.getAllByTestId('route');
const route = (index: number) => {
  const found = routes()[index];
  if (!found) {
    throw new Error(`No route #${index}`);
  }
  return found;
};
const anchors = (container: HTMLElement) => {
  return [...container.querySelectorAll('[data-testid="route"]')].map((el) => el.id);
};

describe('api', () => {
  it('lists every route the block declares, exactly once', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(routes()).toHaveLength(2);
    expect(route(0)).toHaveTextContent('/jobs');
    expect(route(1)).toHaveTextContent('/jobs/:id/pause');
  });

  it('tones each method by what it does', () => {
    const source = doc([
      'routes:',
      '  - { method: GET, path: /jobs }',
      '  - { method: POST, path: /jobs }',
      '  - { method: PATCH, path: /jobs/:id }',
      '  - { method: DELETE, path: /jobs/:id }',
    ]);
    render(<MarkdownDoc source={source} registry={registry} />);
    const tones = routes().map((row) => {
      return within(row)
        .getByText(row.getAttribute('data-method') ?? '')
        .getAttribute('data-tone');
    });
    expect(tones).toEqual(['primary', 'success', 'warning', 'danger']);
  });

  it('emboldens a :param segment in the path', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(route(1).querySelector('b')).toHaveTextContent(':id');
    expect(route(0).querySelector('b')).toBeNull();
  });

  it('leaves a route carrying no detail with nothing to open', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    const plain = route(0);
    expect(plain).not.toHaveAttribute('data-detailed');
    expect(plain.tagName).toBe('DIV');
    expect(plain.querySelector('summary')).toBeNull();
  });

  it.each([
    ['params', ['    params:', '      - { name: id, in: path, type: uuid }']],
    ['a description', ['    description: Cooperative; the current pass completes first.']],
    ['responses', ['    responses:', '      - { status: 204 }']],
    ['transcript', ['    transcript: |', '      $ curl /jobs/9f2c', '      < 200 OK']],
  ])('makes a route carrying %s open', (_field, extra) => {
    const source = doc(['routes:', '  - method: GET', '    path: /jobs/:id', ...extra]);
    render(<MarkdownDoc source={source} registry={registry} />);
    const row = screen.getByTestId('route');
    expect(row).toHaveAttribute('data-detailed', 'true');
    expect(row.tagName).toBe('DETAILS');
    expect(row.querySelector('summary')).not.toBeNull();
  });

  it('starts every row closed, so the reader decides what opens', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(route(1)).not.toHaveAttribute('open');
    expect(screen.getByTestId('route-detail')).not.toBeVisible();
  });

  it('shows the detail once the row is open', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    route(1).setAttribute('open', '');
    expect(screen.getByTestId('route-detail')).toBeVisible();
  });

  it('keeps the method, path and summary on the row rather than in the detail', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    const summary = route(1).querySelector('summary');
    expect(summary).toHaveTextContent('POST');
    expect(summary).toHaveTextContent('/jobs/:id/pause');
    expect(summary).toHaveTextContent('Pauses a running job.');
    expect(screen.getByTestId('route-detail')).not.toHaveTextContent('Pauses a running job.');
  });

  it('gives every route an id, so any of them can be linked to', () => {
    const { container } = render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(anchors(container)).toEqual(['jobs-get-jobs', 'jobs-post-jobs-id-pause']);
  });

  it('scopes the id by resource, so two resources sharing a path do not collide', () => {
    const two = [
      doc(['resource: jobs', 'routes:', '  - { method: GET, path: /jobs }']),
      doc(['resource: admin', 'routes:', '  - { method: GET, path: /jobs }']),
    ].join('\n\n');
    const { container } = render(<MarkdownDoc source={two} registry={registry} />);
    expect(anchors(container)).toEqual(['jobs-get-jobs', 'admin-get-jobs']);
  });

  it('suffixes a repeated route rather than minting the same id twice', () => {
    const source = doc([
      'routes:',
      '  - { method: GET, path: /jobs }',
      '  - { method: GET, path: /jobs }',
    ]);
    const { container } = render(<MarkdownDoc source={source} registry={registry} />);
    expect(anchors(container)).toEqual(['get-jobs', 'get-jobs-2']);
  });

  it('lists every declared parameter with where it goes, in a table named for them', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    const table = screen.getByRole('table', { name: 'Parameters', hidden: true });
    const param = within(table).getByTestId('route-param');
    expect(param).toHaveAttribute('data-in', 'path');
    expect(param).toHaveAttribute('data-required', 'true');
    const cells = within(param).getAllByRole('cell', { hidden: true });
    expect(cells.map((cell) => cell.textContent)).toEqual(['id * (required)', 'path', 'uuid', '']);
  });

  it('lists every response with its status', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    const responses = screen.getAllByTestId('route-response');
    expect(responses).toHaveLength(1);
    expect(responses[0]).toHaveAttribute('data-status', '409');
    expect(responses[0]).toHaveTextContent('job is not running');
  });

  it('tones each status by its class', () => {
    const source = doc([
      'routes:',
      '  - method: POST',
      '    path: /jobs',
      '    responses:',
      '      - { status: 201 }',
      '      - { status: 304 }',
      '      - { status: 409 }',
      '      - { status: 503 }',
    ]);
    render(<MarkdownDoc source={source} registry={registry} />);
    const tones = screen.getAllByTestId('route-response').map((response) => {
      const status = response.getAttribute('data-status') ?? '';
      return within(response).getByText(status).getAttribute('data-tone');
    });
    expect(tones).toEqual(['success', 'primary', 'warning', 'danger']);
  });

  it('rejects a response with no status', () => {
    const bad = doc([
      'routes:',
      '  - { method: GET, path: /jobs, responses: [{ description: Every job }] }',
    ]);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.responses.0.status' });
  });

  it('rejects a field it does not know, naming it', () => {
    const bad = doc(['routes:', '  - { method: GET, path: /jobs, purpose: Load a job }']);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.purpose' });
    expect(errors[0]?.message).toMatch(/purpose/);
  });

  it('renders the description as markdown inside the detail', () => {
    const source = doc([
      'routes:',
      '  - method: GET',
      '    path: /jobs',
      '    description: The **whole** list.',
    ]);
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.getByTestId('route-detail').querySelector('strong')).toHaveTextContent('whole');
  });

  it('shows the response status, description and example body', () => {
    const source = doc([
      'routes:',
      '  - method: POST',
      '    path: /jobs',
      '    responses:',
      '      - status: 201',
      '        description: The created job.',
      '        example: |',
      '          { "id": "9f2c" }',
    ]);
    const { container } = render(<MarkdownDoc source={source} registry={registry} />);
    const response = screen.getByTestId('route-response');
    expect(response).toHaveAttribute('data-status', '201');
    expect(response).toHaveTextContent('The created job.');
    expect(response).toHaveTextContent('{ "id": "9f2c" }');
    // Shown as JSON, and coloured as it.
    expect(response.querySelector('[data-lang]')).toHaveAttribute('data-lang', 'json');
    expect(container.querySelectorAll('[data-code] span').length).toBeGreaterThan(0);
  });

  it('keeps a blank line inside a response example at its rendered height', () => {
    const source = doc([
      'routes:',
      '  - method: POST',
      '    path: /jobs',
      '    responses:',
      '      - status: 201',
      '        example: |',
      '          {',
      '',
      '          }',
    ]);
    const { container } = render(<MarkdownDoc source={source} registry={registry} />);
    const lines = [...container.querySelectorAll('[data-testid="route-response"] [data-code]')];
    expect(lines).toHaveLength(3);
    expect(lines[1]?.textContent).toBe('\n');
  });

  it('renders an inline transcript when one is given, verbatim', () => {
    const source = doc([
      'routes:',
      '  - method: GET',
      '    path: /jobs',
      '    transcript: |',
      '      $ curl /jobs',
      '      < 200 OK',
    ]);
    const { container } = render(<MarkdownDoc source={source} registry={registry} />);
    const transcript = container.querySelector('[data-block="transcript"]');
    expect(transcript?.querySelector('pre code')?.textContent).toBe('$ curl /jobs\n< 200 OK\n');
    expect(within(screen.getByTestId('route-detail')).getByText('terminal')).toBeInTheDocument();
  });

  it('shows the resource as the block heading', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(screen.getByTestId('api-resource')).toHaveTextContent('jobs');
    expect(screen.getByTestId('api')).toHaveAttribute('data-resource', 'jobs');
  });

  it('counts the routes beside the resource', () => {
    render(<MarkdownDoc source={mixed} registry={registry} />);
    expect(screen.getByTestId('api-resource')).toHaveTextContent('2 routes');
  });

  it('draws no heading without a resource', () => {
    render(
      <MarkdownDoc
        source={doc(['routes:', '  - { method: GET, path: /health }'])}
        registry={registry}
      />,
    );
    expect(screen.queryByTestId('api-resource')).toBeNull();
    expect(routes()).toHaveLength(1);
  });

  it('rejects a block declaring no routes', () => {
    const { errors } = validateDocument(doc(['routes: []']), registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes' });
  });

  it('rejects a method that is not an HTTP verb', () => {
    const bad = doc(['routes:', '  - { method: YEET, path: /jobs }']);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.method' });
  });

  it('rejects a path that does not start with a slash', () => {
    const bad = doc(['routes:', '  - { method: GET, path: jobs }']);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.path' });
  });

  it('rejects a parameter with an unknown location', () => {
    const bad = doc([
      'routes:',
      '  - { method: GET, path: /jobs, params: [{ name: id, in: nowhere, type: uuid }] }',
    ]);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.params.0.in' });
  });

  it('rejects a status that is not one', () => {
    const bad = doc(['routes:', '  - { method: GET, path: /jobs, responses: [{ status: 42 }] }']);
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'api', path: 'routes.0.responses.0.status' });
  });
});

describe("api in a page's markdown copy", () => {
  const page = (lines: string[]) => {
    const parsed = parsePage(
      ['body:', '  - api:', ...lines.map((line) => `      ${line}`)].join('\n'),
      registry,
    );
    expect(parsed.issues).toEqual([]);
    return pageMarkdown(parsed, registry);
  };

  it('writes the resource in bold and each route as a line', () => {
    const markdown = page([
      'resource: workers',
      'routes:',
      '  - { method: GET, path: /workers, summary: List every worker. }',
      '  - { method: DELETE, path: /workers/:id }',
    ]);
    expect(markdown).toBe(
      [
        '**workers**',
        '',
        '**`GET /workers`** — List every worker.',
        '',
        '**`DELETE /workers/:id`**',
        '',
      ].join('\n'),
    );
  });

  it('writes the detail as markdown, tables and fences, never YAML', () => {
    const markdown = page([
      'routes:',
      '  - method: POST',
      '    path: /jobs',
      '    summary: Enqueue a job.',
      '    description: Runs **in order**.',
      '    params:',
      '      - { name: kind, in: body, type: string, required: true, description: What to run }',
      '      - { name: dry, in: query, type: bool }',
      '    responses:',
      '      - status: 201',
      '        description: The created job.',
      '        example: |',
      '          { "id": "9f2c" }',
      '      - { status: 422, description: "kind is not a | known type" }',
      '    transcript: |',
      '      $ curl -X POST /jobs',
      '      < 201 Created',
    ]);
    expect(markdown).toBe(
      [
        '**`POST /jobs`** — Enqueue a job.',
        '',
        'Runs **in order**.',
        '',
        'Parameters:',
        '',
        '| Name | In | Type | Required | Description |',
        '|---|---|---|---|---|',
        '| `kind` | body | `string` | yes | What to run |',
        '| `dry` | query | `bool` | no | |',
        '',
        'Responses:',
        '',
        '| Status | Description |',
        '|---|---|',
        '| 201 | The created job. |',
        '| 422 | kind is not a \\| known type |',
        '',
        'Example 201 body:',
        '',
        '```json',
        '{ "id": "9f2c" }',
        '```',
        '',
        'Example call:',
        '',
        '```',
        '$ curl -X POST /jobs',
        '< 201 Created',
        '```',
        '',
      ].join('\n'),
    );
    expect(markdown).not.toMatch(/^routes:/m);
  });
});

describe('api examples', () => {
  const cases = apiBlock.examples.map((example, index) => {
    return { name: `api #${index + 1}`, source: toExample(example).source };
  });

  it.each(cases)('$name validates', ({ source }) => {
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
  });

  it.each(cases)('$name renders without an error card', ({ source }) => {
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(routes().length).toBeGreaterThan(0);
  });
});
