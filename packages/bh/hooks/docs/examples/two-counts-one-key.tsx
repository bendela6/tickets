import { usePersistedState, writeStored } from '@bh/hooks';

// Two counts under one key, and a button that forgets it: a plain view of
// buttons, with no component of bh's, so what shows is the hook.

const KEY = 'docs:hooks:count';
const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';

function Count({ name }: { name: string }) {
  const [count, setCount] = usePersistedState({ key: KEY, defaultValue: 0 });
  return (
    <button type="button" className={BUTTON} onClick={() => setCount((before) => before + 1)}>
      {name}: {count}
    </button>
  );
}

export function TwoCountsOneKey() {
  return (
    <div className="flex flex-col items-start gap-8">
      <div className="flex gap-8">
        <Count name="Left" />
        <Count name="Right" />
      </div>
      <button type="button" className={BUTTON} onClick={() => writeStored(KEY, null)}>
        Forget it
      </button>
    </div>
  );
}
