import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as v from 'valibot';
import { baseKinds, type BaseKind } from '@bh/resource';
import { canShow, fits, type RendererProps, type Shown } from '@bh/template';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AvatarShape, AvatarSize } from '../primitives/components/avatar';
import type { IconSize } from '../primitives/components/icon';
import type { PillVariant } from '../primitives/components/pill';
import { baseDefaultRenderers, baseRenderers, type BaseRenderers } from './base-renderers';
import type { AvatarOptions } from './renderers/avatar';
import type { IconOptions } from './renderers/icon';
import { createLinkRenderer, type LinkAnchor } from './renderers/link';
import type { PillOptions } from './renderers/pill';

/** Draws one of bh's renderers with these values, and options and part options when given. */
function draw<K extends keyof BaseRenderers>(
  name: K,
  values: Shown[],
  more: Partial<RendererProps<BaseRenderers[K]>> = {},
) {
  const { Component } = baseRenderers.get(name) as unknown as {
    Component: (props: RendererProps<BaseRenderers[K]>) => ReactNode;
  };
  const props = {
    values,
    options: {} as BaseRenderers[K],
    part: {},
    record: {},
    ...more,
  };
  return render(<Component {...props} />);
}

/** Whether one of bh's renderers takes these options. */
function accepts(name: keyof BaseRenderers, options: unknown) {
  return v.is(baseRenderers.get(name).options ?? v.strictObject({}), options);
}

describe('baseRenderers', () => {
  it('are bh’s thirteen, frozen', () => {
    expect(baseRenderers.names).toEqual([
      'text',
      'link',
      'pill',
      'date',
      'number',
      'avatar',
      'user',
      'icon',
      'progress',
      'meter',
      'trend',
      'check',
      'code',
    ]);
    expect(Object.isFrozen(baseRenderers)).toBe(true);
    expect(() => baseRenderers.get('sparkline')).toThrow(
      'No renderer is registered as "sparkline".',
    );
  });

  it('check their options by their schemas', () => {
    expectTypeOf<BaseRenderers['trend']>().toEqualTypeOf<{ good?: 'up' | 'down' }>();
    expect(accepts('pill', { variant: 'solid' })).toBe(true);
    expect(accepts('pill', { variant: 'loud' })).toBe(false);
    expect(accepts('avatar', { size: 'lg', shape: 'square' })).toBe(true);
    expect(accepts('avatar', { size: 'huge' })).toBe(false);
    expect(accepts('progress', { max: 8 })).toBe(true);
    expect(accepts('progress', { max: 0 })).toBe(false);
    expect(accepts('meter', {})).toBe(true);
    expect(accepts('trend', { good: 'down' })).toBe(true);
    // A misspelt option is refused.
    expect(accepts('pill', { varient: 'solid' })).toBe(false);
    // One taking no options takes {} alone.
    expect(accepts('text', {})).toBe(true);
    expect(accepts('text', { mono: true })).toBe(false);
  });

  it('link to a route: braces in pairs, starting as an address does', () => {
    expectTypeOf<BaseRenderers['link']>().toEqualTypeOf<{ to?: string }>();
    expect(accepts('link', {})).toBe(true);
    expect(accepts('link', { to: '/p/{project}/t/{number}' })).toBe(true);
    expect(accepts('link', { to: '/p/{project' })).toBe(false);
    expect(accepts('link', { to: 7 })).toBe(false);
    expect(accepts('link', { href: '/p' })).toBe(false);
  });

  it('say which kinds each shows, and the room the bars need', () => {
    expect(canShow(baseRenderers.get('text'), 'json')).toBe(true);
    expect(canShow(baseRenderers.get('link'), 'number')).toBe(true);
    expect(canShow(baseRenderers.get('pill'), 'option')).toBe(true);
    expect(canShow(baseRenderers.get('pill'), 'number')).toBe(false);
    expect(canShow(baseRenderers.get('user'), 'ref')).toBe(true);
    expect(fits(baseRenderers.get('text'), 0)).toBe(true);
    expect(fits(baseRenderers.get('progress'), 48)).toBe(false);
    expect(fits(baseRenderers.get('progress'), 64)).toBe(true);
  });

  it('have the default renderer of each of bh’s kinds, one that shows it', () => {
    expect(Object.keys(baseDefaultRenderers).sort()).toEqual([...baseKinds.names].sort());
    for (const [kind, name] of Object.entries(baseDefaultRenderers)) {
      expect(canShow(baseRenderers.get(name), kind), `${kind} → ${name}`).toBe(true);
    }
    expectTypeOf(baseDefaultRenderers).toEqualTypeOf<
      Readonly<Record<BaseKind, keyof BaseRenderers>>
    >();
  });

  it('take no option their components don’t', () => {
    expectTypeOf<NonNullable<PillOptions['variant']>>().toExtend<PillVariant>();
    expectTypeOf<NonNullable<AvatarOptions['size']>>().toExtend<AvatarSize>();
    expectTypeOf<NonNullable<AvatarOptions['shape']>>().toExtend<AvatarShape>();
    expectTypeOf<NonNullable<IconOptions['size']>>().toExtend<IconSize>();
  });
});

describe('the renderers', () => {
  it('text: the values’ text, a many field’s joined, after the prefix', () => {
    draw('text', [{ value: 'Fix the login', text: 'Fix the login' }], { part: { prefix: '# ' } });
    expect(screen.getByText('# Fix the login')).toBeInTheDocument();
    draw('text', [
      { value: 'auth', text: 'auth' },
      { value: 'web', text: 'web' },
    ]);
    expect(screen.getByText('auth, web')).toBeInTheDocument();
  });

  it('link: an address’s text, to it; a value that is no address, its text alone', () => {
    draw('link', [{ value: 'https://example.com/a', text: 'example.com/a' }]);
    expect(screen.getByRole('link', { name: 'example.com/a' })).toHaveAttribute(
      'href',
      'https://example.com/a',
    );
    draw('link', [{ value: '/api/files/7', text: 'report.pdf' }]);
    expect(screen.getByRole('link', { name: 'report.pdf' })).toHaveAttribute(
      'href',
      '/api/files/7',
    );
    draw('link', [{ value: '//elsewhere.com', text: 'elsewhere' }]);
    expect(screen.queryByRole('link', { name: 'elsewhere' })).toBeNull();
    expect(screen.getByText('elsewhere')).toBeInTheDocument();
    draw('link', [{ value: 'javascript:alert(1)', text: 'run me' }]);
    expect(screen.queryByRole('link', { name: 'run me' })).toBeNull();
  });

  it('link: any field, to its row’s route, filled from the record', () => {
    const ticket = { project: 'TIX', number: 12, title: 'Fix the login' };
    draw('link', [{ value: 12, text: 'TIX-12' }], {
      options: { to: '/p/{project}/t/{number}' },
      record: ticket,
    });
    expect(screen.getByRole('link', { name: 'TIX-12' })).toHaveAttribute('href', '/p/TIX/t/12');
    draw('link', [{ value: 'Fix the login', text: 'Fix the login' }], {
      options: { to: '/search?q={title}' },
      record: ticket,
    });
    expect(screen.getByRole('link', { name: 'Fix the login' })).toHaveAttribute(
      'href',
      '/search?q=Fix%20the%20login',
    );
  });

  it('link: its text alone when its route is missing a value', () => {
    draw('link', [{ value: 'TIX', text: 'TIX' }], {
      options: { to: '/p/{project}/t/{number}' },
      record: { project: 'TIX', number: null },
    });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('TIX')).toBeInTheDocument();
  });

  it('link: drawn with an app’s router link, in TextLink’s look', () => {
    const followed: string[] = [];
    const RouterAnchor: LinkAnchor = ({ href, children, ...look }) => {
      followed.push(href);
      return (
        <a href={`#${href}`} data-router="" {...look}>
          {children}
        </a>
      );
    };
    const RouterLink = createLinkRenderer(RouterAnchor);
    render(
      <RouterLink
        values={[{ value: 12, text: 'TIX-12' }]}
        options={{ to: '/p/{project}/t/{number}' }}
        part={{ mono: true }}
        record={{ project: 'TIX', number: 12 }}
      />,
    );
    const link = screen.getByRole('link', { name: 'TIX-12' });
    expect(link).toHaveAttribute('href', '#/p/TIX/t/12');
    expect(link).toHaveAttribute('data-router');
    expect(followed).toEqual(['/p/TIX/t/12']);
  });

  it('pill: each value in a pill of its own', () => {
    draw(
      'pill',
      [
        { value: 'active', text: 'In progress', tone: 'blue' },
        { value: 'done', text: 'Done', tone: 'success' },
      ],
      { options: { variant: 'solid' } },
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('pill: one value in a span of its own, so a stretching cell keeps its width', () => {
    const { container } = draw('pill', [{ value: 'open', text: 'Open', tone: 'green' }]);
    const own = container.firstElementChild;
    expect(own).toHaveClass('inline-flex');
    expect(own?.firstElementChild).toHaveTextContent('Open');
  });

  it('date: its text, as a time, with the exact day on hover', () => {
    draw('date', [{ value: '2026-10-12T09:30:00.000Z', text: '2 days ago' }]);
    const time = screen.getByText('2 days ago');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-10-12T09:30:00.000Z');
    expect(time).toHaveAttribute('title', 'Oct 12, 2026');
  });

  it('number: its text, in its format', () => {
    draw('number', [{ value: 1234.5, text: '1,234.5' }]);
    expect(screen.getByText('1,234.5')).toBeInTheDocument();
  });

  it('avatar: a ref’s picture named by its title, else its initials', () => {
    draw('avatar', [{ value: 7, text: 'Ada Lovelace', image: '/api/users/7/avatar' }]);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
      'src',
      '/api/users/7/avatar',
    );
    draw('avatar', [{ value: 8, text: 'Grace Hopper' }]);
    expect(screen.getByText('GH')).toBeInTheDocument();
  });

  it('avatar: a url field’s value is its picture', () => {
    const { container } = draw(
      'avatar',
      [{ value: '/media/cover.jpg', text: '/media/cover.jpg' }],
      {
        field: {
          key: 'cover',
          label: 'Cover',
          type: { kind: 'url' },
        },
      },
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/media/cover.jpg');
  });

  it('user: each row by its picture and its title', () => {
    draw('user', [
      { value: 7, text: 'Ada Lovelace' },
      { value: 8, text: 'Grace Hopper', image: '/api/users/8/avatar' },
    ]);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('icon: the glyph its value names; a name the registry lacks, as text', () => {
    draw('icon', [{ value: 'check', text: 'Checked' }]);
    expect(screen.getByRole('img', { name: 'Checked' })).toBeInTheDocument();
    draw('icon', [{ value: 'no-such-glyph', text: 'no-such-glyph' }]);
    expect(screen.getByText('no-such-glyph')).toBeInTheDocument();
  });

  it('progress: the value out of its max, as a bar named by its field', () => {
    draw('progress', [{ value: 3, text: '3 of 4' }], {
      options: { max: 4 },
      field: {
        key: 'steps',
        label: 'Steps',
        type: { kind: 'number' },
      },
    });
    const bar = screen.getByRole('progressbar', { name: 'Steps' });
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
  });

  it('meter: a share of its max, as a meter', () => {
    draw('meter', [{ value: 0.5, text: '50%' }]);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50');
  });

  it('trend: the change’s text, whichever way it goes', () => {
    draw('trend', [{ value: 12, text: '+12%' }]);
    draw('trend', [{ value: -3, text: '−3%' }], { options: { good: 'down' } });
    draw('trend', [{ value: 0, text: '0%' }]);
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('−3%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('check: a check named by its text for true; for false, its text to a screen reader alone', () => {
    draw('check', [{ value: true, text: 'Yes' }]);
    expect(screen.getByRole('img', { name: 'Yes' })).toBeInTheDocument();
    draw('check', [{ value: false, text: 'No' }]);
    expect(screen.queryByRole('img', { name: 'No' })).toBeNull();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('code: its text as code', () => {
    draw('code', [{ value: { a: 1 }, text: '{"a":1}' }]);
    expect(screen.getByText('{"a":1}').tagName).toBe('CODE');
  });

  it('takes no tone a part names that isn’t one of bh’s, and draws anyway', () => {
    draw('text', [{ value: 'x', text: 'Plain' }], { part: { tone: 'chartreuse', clamp: 2 } });
    expect(screen.getByText('Plain')).toBeInTheDocument();
  });
});
