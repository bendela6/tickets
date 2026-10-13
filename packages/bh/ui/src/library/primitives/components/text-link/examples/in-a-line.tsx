import { TextLink } from '@bh/ui';

export function InALine() {
  return (
    <p className="text-12/17 text-gray-11">
      From <TextLink href="#">the design library</TextLink>, newest{' '}
      <TextLink href="#" className="font-600 font-mono">
        v1.4.0
      </TextLink>
      , released two days ago.
    </p>
  );
}
