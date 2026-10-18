import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Icon, ICON_NAMES, type IconName } from '../../primitives/components/icon';
import { defineRenderer } from '../renderer-registry';
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

export const iconRenderer = defineRenderer({
  kinds: ['text'],
  options: iconOptions,
  Component: IconRenderer,
});
