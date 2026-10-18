import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';

const registry = markdownBlocks;
const line = 'Release :badge[stable]{tone=success} today.';

describe('badge', () => {
  it('draws the label inside the sentence around it', () => {
    const { container } = render(<MarkdownDoc source={line} registry={registry} />);
    expect(screen.getByText('stable')).toBeInTheDocument();
    expect(container).toHaveTextContent('Release stable today.');
  });

  it('carries the tone the page wrote', () => {
    render(<MarkdownDoc source={line} registry={registry} />);
    expect(screen.getByText('stable')).toHaveAttribute('data-tone', 'success');
  });

  it('is neutral for a bare tone flag, a tone that is not one, or an inherited property', () => {
    for (const tone of ['{tone}', '{tone=mauve}', '{tone=constructor}', '']) {
      const { unmount } = render(
        <MarkdownDoc source={`Release :badge[beta]${tone} today.`} registry={registry} />,
      );
      expect(screen.getByText('beta')).toHaveAttribute('data-tone', 'neutral');
      unmount();
    }
  });

  it('takes a scale by name as well as a role', () => {
    render(<MarkdownDoc source=":badge[draft]{tone=purple}" registry={registry} />);
    expect(screen.getByText('draft')).toHaveAttribute('data-tone', 'purple');
  });

  it("is the label in bold in a page's markdown copy", () => {
    const page = parsePage(
      ['body:', '  - h2: "Jobs :badge[stable]{tone=success}"'].join('\n'),
      registry,
    );
    expect(pageMarkdown(page, registry)).toBe('## Jobs **stable**\n');
  });
});
