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
