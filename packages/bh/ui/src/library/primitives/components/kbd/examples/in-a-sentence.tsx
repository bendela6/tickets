import { Kbd } from '@bh/ui';

export function InASentence() {
  return (
    <p className="text-14/22 text-gray-12 max-w-480 font-sans">
      Press <Kbd keys="mod+K" size="lg" /> to search from anywhere, move through the results with{' '}
      <Kbd keys="up" size="lg" /> and <Kbd keys="down" size="lg" />, and open one with{' '}
      <Kbd keys="enter" size="lg" />.
    </p>
  );
}
