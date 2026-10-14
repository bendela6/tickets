import { Kbd } from '@bh/ui';

export function Keys() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <Kbd keys="esc" />
      <Kbd keys="/" />
      <Kbd keys={['mod', 'K']} />
      <Kbd keys="mod+shift+P" />
      <Kbd keys="shift+up" />
      <Kbd keys="ctrl+enter" />
      <Kbd keys="F5" />
    </div>
  );
}
