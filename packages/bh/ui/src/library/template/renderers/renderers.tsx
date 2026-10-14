import { Fragment, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import {
  isAddress,
  linkTarget,
  type BaseRenderers,
  type RendererProps,
  type Shown,
} from '@bh/template';
import { cn } from '../../../style';
import { Meter } from '../../feedback/components/meter';
import { Progress } from '../../feedback/components/progress';
import { Avatar } from '../../primitives/components/avatar';
import { Icon, ICON_NAMES, type IconName } from '../../primitives/components/icon';
import { Pill } from '../../primitives/components/pill';
import { formatExact } from '../../primitives/components/relative-date';
import { TextLink } from '../../primitives/components/text-link';
import { partLook, PartText, toneOf } from './look';

// bh's renderers: each draws a part's values, made ready as text in their
// format by what draws the template, with the library's own components. Every
// one is drawn only for a value that isn't empty; a part's `empty` text is the
// template's to draw. Each is in `baseRenderers` with its spec from
// @bh/template.

type Props<K extends keyof BaseRenderers> = RendererProps<BaseRenderers[K]>;

/** The values' text as one: a many field's joined by ', '. */
function joined(values: readonly Shown[]): string {
  return values.map((shown) => shown.text).join(', ');
}

/** The one value's own tone, as an option's color; none for several. */
function ownTone(values: readonly Shown[]): string | undefined {
  return values.length === 1 ? values[0]?.tone : undefined;
}

/** Each value drawn, side by side and wrapping, as a many field's pills are. */
function Each({ values, draw }: { values: readonly Shown[]; draw: (shown: Shown) => ReactNode }) {
  const [only] = values;
  if (values.length === 1 && only) {
    return draw(only);
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-4">
      {values.map((shown, index) => {
        return <Fragment key={index}>{draw(shown)}</Fragment>;
      })}
    </span>
  );
}

/**
 * A value that is an address a link can go to (@bh/template's isAddress):
 * absolute, with a scheme that runs no code, or a path from the root.
 */
function hrefOf(value: Shown['value']): string | undefined {
  return typeof value === 'string' && isAddress(value) ? value : undefined;
}

/** Its text, of any kind: plain, in its format, in the part's look. */
export function TextRenderer({ values, part }: Props<'text'>) {
  return (
    <PartText part={part} tone={ownTone(values)}>
      {joined(values)}
    </PartText>
  );
}

/**
 * What draws a link in place of TextLink's own `<a>`: an app's router link,
 * which follows `href` without loading the page. TextLink gives it its look
 * (`asChild`), so it puts the className and style it's given on its element.
 */
export type LinkAnchor = ComponentType<{
  href: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}>;

/**
 * The link renderer, its links drawn with `Anchor` in TextLink's look, or
 * with TextLink's own `<a>` when it's given none. An app whose router follows
 * its links registers its own over bh's:
 * `link: { ...baseRenderers.link, Component: createLinkRenderer(RouterAnchor) }`.
 */
export function createLinkRenderer(Anchor?: LinkAnchor) {
  return function LinkRenderer({ values, options, part, record }: Props<'link'>) {
    // A route is the record's, the same for each of its values.
    const route = options.to === undefined ? undefined : linkTarget(options.to, record);
    return (
      <Each
        values={values}
        draw={(shown) => {
          const href = options.to === undefined ? hrefOf(shown.value) : route;
          if (href === undefined) {
            return (
              <PartText part={part} tone={shown.tone}>
                {shown.text}
              </PartText>
            );
          }
          const look = partLook(part, shown.tone);
          if (Anchor === undefined) {
            return (
              <TextLink href={href} className={look.className} style={look.style}>
                {part.prefix}
                {shown.text}
              </TextLink>
            );
          }
          return (
            <TextLink asChild className={look.className} style={look.style}>
              <Anchor href={href}>
                {part.prefix}
                {shown.text}
              </Anchor>
            </TextLink>
          );
        }}
      />
    );
  };
}

/**
 * Its text, to its route (`to`, filled from the record by linkTarget), or a
 * url's to itself; its text alone where it has nowhere to go: a route a value
 * is missing from, or a value that is no address.
 */
export const LinkRenderer = createLinkRenderer();

/** Each value in a pill: an option in its color, the part's tone over it. */
export function PillRenderer({ values, options, part }: Props<'pill'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        return (
          <Pill
            size="sm"
            variant={options.variant}
            tone={toneOf(part.tone ?? shown.tone) ?? 'neutral'}
            label={`${part.prefix ?? ''}${shown.text}`}
          />
        );
      }}
    />
  );
}

/** A date's or a datetime's text, in its format, with the exact day on hover. */
export function DateRenderer({ values, part }: Props<'date'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = String(shown.value);
        const exact = Number.isNaN(Date.parse(value)) ? undefined : formatExact(value);
        return (
          <PartText part={part} tone={shown.tone}>
            <time dateTime={value} title={exact}>
              {shown.text}
            </time>
          </PartText>
        );
      }}
    />
  );
}

/** A number's text, in its format, its digits of one width so a column of them lines up. */
export function NumberRenderer({ values, part }: Props<'number'>) {
  return (
    <PartText part={part} tone={ownTone(values)} className="tabular-nums">
      {joined(values)}
    </PartText>
  );
}

const PICTURE_SIZE = { xs: 'size-16', sm: 'size-18', md: 'size-22', lg: 'size-28', xl: 'size-36' };

/**
 * One value's picture: its image (a ref's row's, or a url value's own), or
 * else its text's initials, as Avatar draws them.
 */
function Picture({
  shown,
  size = 'sm',
  shape = 'round',
  fromUrl,
}: {
  shown: Shown;
  size?: keyof typeof PICTURE_SIZE;
  shape?: 'round' | 'square';
  /** Its value is a url, so the value is the picture's address and its text no name. */
  fromUrl: boolean;
}) {
  const address = fromUrl ? hrefOf(shown.value) : undefined;
  const image = shown.image ?? address;
  if (image === undefined) {
    return <Avatar name={shown.text} size={size} shape={shape} />;
  }
  return (
    <img
      src={image}
      // A ref's picture is named by its row's title; a url's own address names nothing.
      alt={shown.image === undefined ? '' : shown.text}
      loading="lazy"
      className={cn(
        'shrink-0 object-cover',
        PICTURE_SIZE[size],
        shape === 'square' ? 'rounded-6' : 'rounded-full',
      )}
    />
  );
}

/** A picture alone: a url's, or that of the row a ref points at, else its initials. */
export function AvatarRenderer({ values, options, field }: Props<'avatar'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        return (
          <Picture
            shown={shown}
            size={options.size}
            shape={options.shape}
            fromUrl={field?.type.kind === 'url'}
          />
        );
      }}
    />
  );
}

/** The row a ref points at, by its picture and its title: a user's avatar and name. */
export function UserRenderer({ values, options, part }: Props<'user'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        return (
          <span className="inline-flex min-w-0 items-center gap-6">
            <Picture shown={shown} size={options.size} fromUrl={false} />
            <PartText part={part} tone={shown.tone}>
              {shown.text}
            </PartText>
          </span>
        );
      }}
    />
  );
}

const isIconName = (name: string): name is IconName => {
  return (ICON_NAMES as readonly string[]).includes(name);
};

/** A glyph from the icon registry, by the value's name; a name it doesn't hold is its text. */
export function IconRenderer({ values, options, part }: Props<'icon'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const name = String(shown.value);
        if (!isIconName(name)) {
          return <PartText part={part}>{shown.text}</PartText>;
        }
        return (
          <Icon
            name={name}
            size={options.size}
            tone={toneOf(part.tone ?? shown.tone)}
            label={shown.text}
          />
        );
      }}
    />
  );
}

/** The value as a number, or undefined for one that isn't. */
function numberOf(shown: Shown): number | undefined {
  return typeof shown.value === 'number' && Number.isFinite(shown.value) ? shown.value : undefined;
}

/** A bar of how far along: the value out of `max` (100), its text after it. */
export function ProgressRenderer({ values, options, part, field }: Props<'progress'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown);
        if (value === undefined) {
          return <PartText part={part}>{shown.text}</PartText>;
        }
        return (
          <Progress
            value={(value / (options.max ?? 100)) * 100}
            size="sm"
            tone={toneOf(part.tone ?? shown.tone)}
            trailing={shown.text}
            aria-label={field?.label ?? shown.text}
            className="min-w-0"
          />
        );
      }}
    />
  );
}

/** A bar of a share of a whole: the value out of `max` (1), toned by how full it is. */
export function MeterRenderer({ values, options, part, field }: Props<'meter'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown);
        if (value === undefined) {
          return <PartText part={part}>{shown.text}</PartText>;
        }
        return (
          <Meter
            label={field?.label ?? shown.text}
            fraction={value / (options.max ?? 1)}
            tone={toneOf(part.tone ?? shown.tone)}
            showLabel={false}
          />
        );
      }}
    />
  );
}

/**
 * A change: its text after an arrow its way, toned success when that way is
 * good (`good`, up by default) and danger when it isn't. No change has no
 * arrow and no tone.
 */
export function TrendRenderer({ values, options, part }: Props<'trend'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown) ?? 0;
        const way = value > 0 ? 'up' : value < 0 ? 'down' : undefined;
        const good = way === (options.good ?? 'up') ? 'success' : 'danger';
        const look = partLook(part, way === undefined ? undefined : good);
        return (
          <span
            className={cn('inline-flex items-center gap-2 tabular-nums', look.className)}
            style={look.style}
          >
            {way === undefined ? null : <Icon name={`arrow-${way}`} size="xs" />}
            {part.prefix}
            {shown.text}
          </span>
        );
      }}
    />
  );
}

/** A check for true, named by its text; false shows nothing, and says its text to a screen reader. */
export function CheckRenderer({ values, part }: Props<'check'>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        if (shown.value !== true) {
          return <span className="sr-only">{shown.text}</span>;
        }
        return <Icon name="check" tone={toneOf(part.tone ?? shown.tone)} label={shown.text} />;
      }}
    />
  );
}

/** JSON, or text, as code, in the mono face. */
export function CodeRenderer({ values, part }: Props<'code'>) {
  return (
    <PartText part={{ ...part, mono: true }}>
      <code>{joined(values)}</code>
    </PartText>
  );
}
