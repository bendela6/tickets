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
