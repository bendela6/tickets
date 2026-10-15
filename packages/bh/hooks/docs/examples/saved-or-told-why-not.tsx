import { useState } from 'react';
import { useAction } from '@bh/hooks';

// A name saved to a pretend server that takes a moment and refuses "admin":
// a plain form, no component of bh's, with the hook's three states shown.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6 disabled:opacity-50';

/** The pretend server: three quarters of a second, then the name or a refusal. */
function saveName(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (name.trim().toLowerCase() === 'admin') {
        reject(new Error('“admin” is taken: pick another name.'));
      } else {
        resolve(name.trim());
      }
    }, 750);
  });
}

export function SavedOrToldWhyNot() {
  const [name, setName] = useState('admin');
  const save = useAction(saveName);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save.run(name);
      }}
      className="flex w-320 flex-col gap-8"
    >
      <label className="text-12/17 text-gray-11 flex flex-col gap-4">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-gray-6 rounded-6 text-gray-12 border-1 px-8 py-4"
        />
      </label>
      <div className="flex items-center gap-8">
        <button type="submit" className={BUTTON} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {save.result === undefined ? null : (
          <span className="text-12/17 text-gray-10">Saved as {save.result}.</span>
        )}
      </div>
      {save.error ? (
        <p role="alert" className="text-12/17 text-red-11">
          {save.error.message}
        </p>
      ) : null}
    </form>
  );
}
