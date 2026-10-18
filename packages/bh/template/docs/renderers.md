---
title: Renderers
summary: A renderer draws a part's value. bh registers thirteen; an app
  registers its own.
order: 3
related: [Overview, Layouts, Formats]
---

[//]: # 'written from renderers.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Renderers

A renderer draws a part's value: text, a link, a pill, a bar. A part names
one in `renderer`. Without one, it takes its field kind's default.

**Every renderer**

```tsx
import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'code', label: 'Code', type: { kind: 'text' } },
  {
    key: 'status',
    label: 'Status',
    type: {
      kind: 'option',
      settings: { options: [{ value: 'open', label: 'Open', color: 'green' }] },
    },
  },
  { key: 'booked', label: 'Booked', type: { kind: 'date' } },
  { key: 'seats', label: 'Seats', type: { kind: 'number' } },
  { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'people' } } },
  { key: 'icon', label: 'Icon', type: { kind: 'text' } },
  { key: 'done', label: 'Done', type: { kind: 'number' } },
  { key: 'share', label: 'Share', type: { kind: 'number' }, format: 'percent' },
  { key: 'change', label: 'Change', type: { kind: 'number' }, format: 'percent' },
  { key: 'paid', label: 'Paid', type: { kind: 'boolean' } },
  { key: 'extra', label: 'Extra', type: { kind: 'json' } },
];

const RECORD = {
  title: 'Repaint the hall',
  code: 'R-12',
  status: 'open',
  booked: '2026-07-13',
  seats: 1234.5,
  owner: 7,
  icon: 'calendar',
  done: 64,
  share: 0.72,
  change: 0.12,
  paid: true,
  extra: { seats: 4 },
};

const TEMPLATE: TemplateNode = {
  layout: 'grid',
  options: { columns: 2, gap: 3, align: 'center' },
  nodes: [
    { value: 'text', options: { mono: true, tone: 'gray' } },
    { field: 'title', renderer: 'text' },
    { value: 'link', options: { mono: true, tone: 'gray' } },
    { field: 'code', renderer: { name: 'link', options: { to: '/rooms/{code}' } } },
    { value: 'pill', options: { mono: true, tone: 'gray' } },
    { field: 'status', renderer: 'pill' },
    { value: 'date', options: { mono: true, tone: 'gray' } },
    { field: 'booked', renderer: 'date' },
    { value: 'number', options: { mono: true, tone: 'gray' } },
    { field: 'seats', renderer: 'number' },
    { value: 'avatar', options: { mono: true, tone: 'gray' } },
    { field: 'owner', renderer: 'avatar' },
    { value: 'user', options: { mono: true, tone: 'gray' } },
    { field: 'owner', renderer: 'user' },
    { value: 'icon', options: { mono: true, tone: 'gray' } },
    { field: 'icon', renderer: 'icon' },
    { value: 'progress', options: { mono: true, tone: 'gray' } },
    { field: 'done', renderer: 'progress' },
    { value: 'meter', options: { mono: true, tone: 'gray' } },
    { field: 'share', renderer: 'meter' },
    { value: 'trend', options: { mono: true, tone: 'gray' } },
    { field: 'change', renderer: 'trend' },
    { value: 'check', options: { mono: true, tone: 'gray' } },
    { field: 'paid', renderer: 'check' },
    { value: 'code', options: { mono: true, tone: 'gray' } },
    { field: 'extra', renderer: 'code' },
  ],
};

export function EveryRenderer() {
  return (
    <Template
      template={TEMPLATE}
      record={RECORD}
      fields={FIELDS}
      refOf={() => ({ title: 'Ana Lee' })}
    />
  );
}
```

## The registry

`noRenderers`, in `@bh/ui`, is the empty registry. It checks each
renderer's kinds, options schema, least width and component.

`packages/web/ui/src/library/template/renderer-registry.ts`, line 1:

```ts
import type { ComponentType } from 'react';
import * as v from 'valibot';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { rendererData, type RendererEntry, type RendererProps } from '@bh/template';

/** A renderer: its spec and its React component. */
export type RendererDefinition<O = Record<string, never>> = RendererEntry<
  ComponentType<RendererProps<O>>,
  O
>;

/** Renderers by name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RendererRegistry = RegistryOf<RendererDefinition<any>>;

/** A React component: a function, a class, or a memo, forwardRef or lazy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentSchema = v.custom<ComponentType<any>>((value) => {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}, 'its Component is a component');

/** The empty renderer registry. */
export const noRenderers = defineRegistry({
  name: 'renderer',
  schema: v.object({ ...rendererData.entries, Component: componentSchema }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(renderer: RendererDefinition<O>): RendererDefinition<any> => renderer,
});
```

## The renderers

| Renderer   | Draws                           | Kinds          | Options         | Default for                    |
| ---------- | ------------------------------- | -------------- | --------------- | ------------------------------ |
| `text`     | its text                        | any            |                 | text, markdown, richtext, time |
| `link`     | a link to `to`, or to the url   | any            | `to`            | url, email, phone, file        |
| `pill`     | a pill in the option's color    | option, text   | `variant`       | option                         |
| `date`     | a date, the exact time on hover | date, datetime |                 | date, datetime                 |
| `number`   | digits of even width            | number         |                 | number                         |
| `avatar`   | a picture, else initials        | url, ref       | `size`, `shape` |                                |
| `user`     | a picture and a name            | ref            | `size`          | ref                            |
| `icon`     | an icon by name                 | text           | `size`          |                                |
| `progress` | a bar out of `max` (100)        | number         | `max`           |                                |
| `meter`    | a bar out of `max` (1)          | number         | `max`           |                                |
| `trend`    | an arrow, green the good way    | number         | `good`          |                                |
| `check`    | a check for true                | boolean        |                 | boolean                        |
| `code`     | mono text                       | json, text     |                 | json                           |

`user` and `progress` need 64px, `meter` 80px, `trend` 40px. A narrower
host leaves them out. Every renderer takes the part's `options` too:
`tone`, `mono`, `weight`, `clamp`, `prefix` and `empty`.

A link's `to` is a route filled from the record: `/rooms/{code}`. A
missing value leaves it unlinked.

Each renderer is one file: its options, its component and its entry.

### text

`packages/web/ui/src/library/template/renderers/text.tsx`, line 1:

```tsx
import type { RendererProps } from '@bh/template';
import { noRenderers } from '../renderer-registry';
import { joined, ownTone } from './each';
import { PartText } from './look';

/** Its text, any kind. */
export function TextRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={part} tone={ownTone(values)}>
      {joined(values)}
    </PartText>
  );
}

export const textRenderer = noRenderers.define({
  kinds: 'any',
  Component: TextRenderer,
});
```

### link

`packages/web/ui/src/library/template/renderers/link.tsx`, line 1:

```tsx
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import * as v from 'valibot';
import { isRoute, linkTarget, type RendererProps } from '@bh/template';
import { TextLink } from '../../primitives/components/text-link';
import { noRenderers } from '../renderer-registry';
import { Each, hrefOf } from './each';
import { partLook, PartText } from './look';

const linkOptions = v.strictObject({
  /** A route filled from the record: `/p/{project}/t/{number}`. Default the url itself. */
  to: v.optional(
    v.pipe(
      v.string(),
      v.check(
        isRoute,
        'a route is a path from the root or an address with its scheme, its braces in pairs',
      ),
    ),
  ),
});

export type LinkOptions = v.InferOutput<typeof linkOptions>;

/** An app's router link, drawn in TextLink's look. */
export type LinkAnchor = ComponentType<{
  href: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}>;

/**
 * A link renderer drawing with `Anchor`, or with `<a>`. An app overrides bh's:
 * `baseRenderers.override({ link: { ...linkRenderer, Component: createLinkRenderer(RouterAnchor) } })`.
 */
export function createLinkRenderer(Anchor?: LinkAnchor) {
  return function LinkRenderer({ values, options, part, record }: RendererProps<LinkOptions>) {
    // One route per record.
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

/** Its text, linked to `to` or to the url. Unlinked when neither works. */
export const LinkRenderer = createLinkRenderer();

export const linkRenderer = noRenderers.define({
  kinds: 'any',
  options: linkOptions,
  Component: LinkRenderer,
});
```

### pill

`packages/web/ui/src/library/template/renderers/pill.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Pill } from '../../primitives/components/pill';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { toneOf } from './look';

const pillOptions = v.strictObject({
  /** The Pill variant. Default `subtle`. */
  variant: v.optional(v.picklist(['subtle', 'solid', 'outline', 'text', 'tint'])),
});

export type PillOptions = v.InferOutput<typeof pillOptions>;

/** Each value in a pill, in its tone. */
export function PillRenderer({ values, options, part }: RendererProps<PillOptions>) {
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

export const pillRenderer = noRenderers.define({
  kinds: ['option', 'text'],
  options: pillOptions,
  Component: PillRenderer,
});
```

### date

`packages/web/ui/src/library/template/renderers/date.tsx`, line 1:

```tsx
import type { RendererProps } from '@bh/template';
import { formatExact } from '../../primitives/components/relative-date';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { PartText } from './look';

/** A date, the exact moment on hover. */
export function DateRenderer({ values, part }: RendererProps) {
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

export const dateRenderer = noRenderers.define({
  kinds: ['date', 'datetime'],
  Component: DateRenderer,
});
```

### number

`packages/web/ui/src/library/template/renderers/number.tsx`, line 1:

```tsx
import type { RendererProps } from '@bh/template';
import { noRenderers } from '../renderer-registry';
import { joined, ownTone } from './each';
import { PartText } from './look';

/** A number, its digits of even width. */
export function NumberRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={part} tone={ownTone(values)} className="tabular-nums">
      {joined(values)}
    </PartText>
  );
}

export const numberRenderer = noRenderers.define({
  kinds: ['number'],
  Component: NumberRenderer,
});
```

### avatar

`packages/web/ui/src/library/template/renderers/avatar.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { avatarSize } from './options';
import { Picture } from './picture';

const avatarOptions = v.strictObject({
  /** The Avatar size. Default `sm`. */
  size: v.optional(avatarSize),
  /** `round` or `square`. Default `round`. */
  shape: v.optional(v.picklist(['round', 'square'])),
});

export type AvatarOptions = v.InferOutput<typeof avatarOptions>;

/** A picture, else initials. */
export function AvatarRenderer({ values, options, field }: RendererProps<AvatarOptions>) {
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

export const avatarRenderer = noRenderers.define({
  kinds: ['url', 'ref'],
  options: avatarOptions,
  Component: AvatarRenderer,
});
```

### user

`packages/web/ui/src/library/template/renderers/user.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { PartText } from './look';
import { avatarSize } from './options';
import { Picture } from './picture';

const userOptions = v.strictObject({
  /** The Avatar size. Default `sm`. */
  size: v.optional(avatarSize),
});

export type UserOptions = v.InferOutput<typeof userOptions>;

/** A ref's picture and title. */
export function UserRenderer({ values, options, part }: RendererProps<UserOptions>) {
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

export const userRenderer = noRenderers.define({
  kinds: ['ref'],
  options: userOptions,
  minWidth: 64,
  Component: UserRenderer,
});
```

### icon

`packages/web/ui/src/library/template/renderers/icon.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Icon, ICON_NAMES, type IconName } from '../../primitives/components/icon';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { PartText, toneOf } from './look';

const iconOptions = v.strictObject({
  /** The Icon size. Default `md`. */
  size: v.optional(v.picklist(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'])),
});

export type IconOptions = v.InferOutput<typeof iconOptions>;

const isIconName = (name: string): name is IconName => {
  return (ICON_NAMES as readonly string[]).includes(name);
};

/** An icon, by the value's name. An unknown name shows as text. */
export function IconRenderer({ values, options, part }: RendererProps<IconOptions>) {
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

export const iconRenderer = noRenderers.define({
  kinds: ['text'],
  options: iconOptions,
  Component: IconRenderer,
});
```

### progress

`packages/web/ui/src/library/template/renderers/progress.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Progress } from '../../feedback/components/progress';
import { noRenderers } from '../renderer-registry';
import { Each, numberOf } from './each';
import { PartText, toneOf } from './look';
import { positive } from './options';

const progressOptions = v.strictObject({
  /** What fills the bar. Default 100. */
  max: v.optional(positive),
});

export type ProgressOptions = v.InferOutput<typeof progressOptions>;

/** A bar: the value out of `max`, its text after. */
export function ProgressRenderer({ values, options, part, field }: RendererProps<ProgressOptions>) {
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

export const progressRenderer = noRenderers.define({
  kinds: ['number'],
  options: progressOptions,
  minWidth: 64,
  Component: ProgressRenderer,
});
```

### meter

`packages/web/ui/src/library/template/renderers/meter.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Meter } from '../../feedback/components/meter';
import { noRenderers } from '../renderer-registry';
import { Each, numberOf } from './each';
import { PartText, toneOf } from './look';
import { positive } from './options';

const meterOptions = v.strictObject({
  /** The whole. Default 1. */
  max: v.optional(positive),
});

export type MeterOptions = v.InferOutput<typeof meterOptions>;

/** A share of a whole, toned by how full. */
export function MeterRenderer({ values, options, part, field }: RendererProps<MeterOptions>) {
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

export const meterRenderer = noRenderers.define({
  kinds: ['number'],
  options: meterOptions,
  minWidth: 80,
  Component: MeterRenderer,
});
```

### trend

`packages/web/ui/src/library/template/renderers/trend.tsx`, line 1:

```tsx
import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { cn } from '../../../style';
import { Icon } from '../../primitives/components/icon';
import { noRenderers } from '../renderer-registry';
import { Each, numberOf } from './each';
import { partLook } from './look';

const trendOptions = v.strictObject({
  /** The good way: `up` or `down`. Default `up`. */
  good: v.optional(v.picklist(['up', 'down'])),
});

export type TrendOptions = v.InferOutput<typeof trendOptions>;

/** A change, with an arrow, green the good way. */
export function TrendRenderer({ values, options, part }: RendererProps<TrendOptions>) {
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

export const trendRenderer = noRenderers.define({
  kinds: ['number'],
  options: trendOptions,
  minWidth: 40,
  Component: TrendRenderer,
});
```

### check

`packages/web/ui/src/library/template/renderers/check.tsx`, line 1:

```tsx
import type { RendererProps } from '@bh/template';
import { Icon } from '../../primitives/components/icon';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { toneOf } from './look';

/** A check for true. False is read out, not shown. */
export function CheckRenderer({ values, part }: RendererProps) {
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

export const checkRenderer = noRenderers.define({
  kinds: ['boolean'],
  Component: CheckRenderer,
});
```

### code

`packages/web/ui/src/library/template/renderers/code.tsx`, line 1:

```tsx
import type { RendererProps } from '@bh/template';
import { noRenderers } from '../renderer-registry';
import { joined } from './each';
import { PartText } from './look';

/** JSON or text, in mono. */
export function CodeRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={{ ...part, mono: true }}>
      <code>{joined(values)}</code>
    </PartText>
  );
}

export const codeRenderer = noRenderers.define({
  kinds: ['json', 'text'],
  Component: CodeRenderer,
});
```

## Registering them

`baseRenderers` registers all thirteen. `BaseRenderers` types their
options. `baseDefaultRenderers` names each kind's default.

`packages/web/ui/src/library/template/base-renderers.ts`, line 1:

```ts
import type { BaseKind } from '@bh/resource';
import { avatarRenderer, type AvatarOptions } from './renderers/avatar';
import { checkRenderer } from './renderers/check';
import { codeRenderer } from './renderers/code';
import { dateRenderer } from './renderers/date';
import { iconRenderer, type IconOptions } from './renderers/icon';
import { linkRenderer, type LinkOptions } from './renderers/link';
import { meterRenderer, type MeterOptions } from './renderers/meter';
import { numberRenderer } from './renderers/number';
import { pillRenderer, type PillOptions } from './renderers/pill';
import { progressRenderer, type ProgressOptions } from './renderers/progress';
import { textRenderer } from './renderers/text';
import { trendRenderer, type TrendOptions } from './renderers/trend';
import { userRenderer, type UserOptions } from './renderers/user';
import { noRenderers } from './renderer-registry';

/** No options. */
type NoOptions = Record<string, never>;

/** bh's renderers, by name, with their options. */
export interface BaseRenderers {
  text: NoOptions;
  link: LinkOptions;
  pill: PillOptions;
  date: NoOptions;
  number: NoOptions;
  avatar: AvatarOptions;
  user: UserOptions;
  icon: IconOptions;
  progress: ProgressOptions;
  meter: MeterOptions;
  trend: TrendOptions;
  check: NoOptions;
  code: NoOptions;
}

/** bh's thirteen renderers. */
export const baseRenderers = noRenderers.register({
  text: textRenderer,
  link: linkRenderer,
  pill: pillRenderer,
  date: dateRenderer,
  number: numberRenderer,
  avatar: avatarRenderer,
  user: userRenderer,
  icon: iconRenderer,
  progress: progressRenderer,
  meter: meterRenderer,
  trend: trendRenderer,
  check: checkRenderer,
  code: codeRenderer,
});

/** Each kind's default renderer. An app adds its own: `{ ...baseDefaultRenderers, color: 'swatch' }`. */
export const baseDefaultRenderers: Readonly<Record<BaseKind, keyof BaseRenderers>> = Object.freeze({
  text: 'text',
  markdown: 'text',
  richtext: 'text',
  url: 'link',
  email: 'link',
  phone: 'link',
  number: 'number',
  boolean: 'check',
  date: 'date',
  time: 'text',
  datetime: 'date',
  option: 'pill',
  ref: 'user',
  file: 'link',
  json: 'code',
});
```

## Your own renderer

Define a renderer on `baseRenderers`, then register it. `register`
returns a new registry; `baseRenderers` is unchanged. The component gets
`RendererProps`: the values in their format, its options, the part's
options and the record.

```tsx
import type { RendererProps } from '@bh/template';
import { baseRenderers } from '@bh/ui';

function Swatch({ values }: RendererProps) {
  return values.map((shown, index) => (
    <span
      key={index}
      className="rounded-2 inline-block size-12"
      style={{ background: String(shown.value) }}
    />
  ));
}

const swatch = baseRenderers.define({ kinds: ['text'], Component: Swatch });

export const renderers = baseRenderers.register({ swatch });
```

```ts
interface RendererProps<O = Record<string, never>>
```

What a renderer draws a part from. `O` is its options.

| Member               | Type               | Default | Description                                                    |
| -------------------- | ------------------ | ------- | -------------------------------------------------------------- |
| `values` (required)  | `readonly Shown[]` |         | The values: one, or one per entry of a many field. Never none. |
| `options` (required) | `O`                |         | Its own options. `{}` when the part names it alone.            |
| `part` (required)    | `PartOptions`      |         | The part's options: tone, mono, weight, clamp, prefix.         |
| `field`              | `TemplateField`    |         | The field, for a field part.                                   |
| `record` (required)  | `Row`              |         | The record.                                                    |
