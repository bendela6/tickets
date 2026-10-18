import type { Shown } from '@bh/template';
import { cn } from '../../../style';
import { Avatar } from '../../primitives/components/avatar';
import { hrefOf } from './each';

const PICTURE_SIZE = { xs: 'size-16', sm: 'size-18', md: 'size-22', lg: 'size-28', xl: 'size-36' };

/** A value's picture, else its initials. */
export function Picture({
  shown,
  size = 'sm',
  shape = 'round',
  fromUrl,
}: {
  shown: Shown;
  size?: keyof typeof PICTURE_SIZE;
  shape?: 'round' | 'square';
  /** The value is the picture's url. */
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
      // A ref's title names it; a bare url doesn't.
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
