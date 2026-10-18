import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { defineRenderer } from '../renderer-registry';
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

export const avatarRenderer = defineRenderer({
  kinds: ['url', 'ref'],
  options: avatarOptions,
  Component: AvatarRenderer,
});
