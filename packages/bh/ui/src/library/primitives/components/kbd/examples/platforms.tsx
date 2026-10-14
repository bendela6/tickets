import { Kbd } from '@bh/ui';

const CHORDS = ['mod+K', 'mod+shift+Z', 'alt+left', 'mod+enter', 'backspace'];

export function Platforms() {
  return (
    <table className="text-13/19 text-gray-11 font-sans">
      <thead>
        <tr className="text-12 text-gray-10 text-left">
          <th className="font-500 pr-24 pb-8">Written</th>
          <th className="font-500 pr-24 pb-8">On a Mac</th>
          <th className="font-500 pb-8">Elsewhere</th>
        </tr>
      </thead>
      <tbody>
        {CHORDS.map((chord) => {
          return (
            <tr key={chord}>
              <td className="py-4 pr-24 font-mono">{chord}</td>
              <td className="py-4 pr-24">
                <Kbd keys={chord} platform="apple" />
              </td>
              <td className="py-4">
                <Kbd keys={chord} platform="other" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
