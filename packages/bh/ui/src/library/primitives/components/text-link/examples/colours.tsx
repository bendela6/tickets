import { TextLink } from '@bh/ui';

export function Colours() {
  return (
    <p className="text-12/17 text-gray-11 flex flex-wrap gap-x-12 gap-y-4">
      <TextLink href="#">Run 41 is live</TextLink>
      <TextLink href="#" className="text-red-11">
        Run 42 failed
      </TextLink>
      <TextLink href="#" className="text-orange-11">
        2 settings missing
      </TextLink>
      <TextLink href="#" className="font-mono text-inherit">
        main@4f2a91c
      </TextLink>
    </p>
  );
}
