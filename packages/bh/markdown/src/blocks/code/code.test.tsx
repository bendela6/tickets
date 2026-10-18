import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { markdownBlocks } from '..';

const registry = markdownBlocks;
const fence = (info: string, ...lines: string[]) => ['```code' + info, ...lines, '```'].join('\n');

const rows = (container: HTMLElement) => [...container.querySelectorAll('[data-line]')];

describe('code', () => {
  it('numbers every line by default', () => {
    const { container } = render(
      <MarkdownDoc source={fence('', 'a', 'b', 'c')} registry={registry} />,
    );
    expect(rows(container)).toHaveLength(3);
    expect(rows(container)[2]).toHaveTextContent('3');
  });

  it('leaves one line unnumbered, unless asked', () => {
    const one = render(<MarkdownDoc source={fence('', 'a')} registry={registry} />);
    expect(rows(one.container)[0]).not.toHaveTextContent('1');
    const asked = render(<MarkdownDoc source={fence('{numbers}', 'a')} registry={registry} />);
    expect(rows(asked.container)[0]).toHaveTextContent('1');
  });

  it('drops the numbers when asked', () => {
    const { container } = render(
      <MarkdownDoc source={fence('{numbers=false}', 'a')} registry={registry} />,
    );
    expect(rows(container)[0]).not.toHaveTextContent('1');
  });

  it('marks the lines it is told about and no others', () => {
    const { container } = render(
      <MarkdownDoc source={fence('{lines=2-3}', 'a', 'b', 'c', 'd')} registry={registry} />,
    );
    const marked = rows(container).filter((row) => row.getAttribute('data-mark') === 'true');
    expect(marked.map((row) => row.getAttribute('data-line'))).toEqual(['2', '3']);
  });

  it('names the file and the language in the strip', () => {
    const { container } = render(
      <MarkdownDoc
        source={fence('{lang=ts file=src/app.ts}', 'const a = 1;')}
        registry={registry}
      />,
    );
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(container.querySelector('[data-lang]')).toHaveAttribute('data-lang', 'ts');
  });

  it('colours a known language and leaves an unknown one plain', () => {
    const coloured = render(
      <MarkdownDoc source={fence('{lang=ts}', 'const a = 1;')} registry={registry} />,
    );
    expect(coloured.container.querySelectorAll('[data-code] span').length).toBeGreaterThan(0);
    coloured.unmount();
    const plain = render(
      <MarkdownDoc source={fence('{lang=cobol}', 'MOVE 1 TO A.')} registry={registry} />,
    );
    expect(plain.container.querySelectorAll('[data-code] span')).toHaveLength(0);
  });

  it('keeps the text verbatim, including indentation', () => {
    const { container } = render(
      <MarkdownDoc source={fence('', 'if (x) {', '    return;', '}')} registry={registry} />,
    );
    expect(rows(container)[1]?.querySelector('[data-code]')?.textContent).toBe('    return;');
  });

  it('copies the code, without the numbers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<MarkdownDoc source={fence('', 'a', 'b')} registry={registry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('a\nb'));
    vi.unstubAllGlobals();
  });

  it("reads as a plain fence in a page's markdown copy", () => {
    const yaml = ['body:', '  - code: pnpm i', '    lang: sh', '    numbers: false'].join('\n');
    const page = parsePage(yaml, registry);
    expect(pageMarkdown(page, registry)).toBe(['```sh', 'pnpm i', '```', ''].join('\n'));
  });
});
