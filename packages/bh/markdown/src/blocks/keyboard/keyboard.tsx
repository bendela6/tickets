import { Fragment } from 'react';
import { chordOf, type KeyboardData } from './schema';

const KEY =
  'rounded-4 border-gray-6 bg-surface-raised text-12 text-gray-12 inline-block min-w-22 border-1 border-b-2 px-6 text-center font-mono leading-20';

/** One key, or a chord as its keys joined by `+`. */
function Key({ value }: { value: string }) {
  const parts = chordOf(value);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {parts.map((part, index) => {
        return (
          <Fragment key={index}>
            {index > 0 ? <span className="text-12 text-gray-9">+</span> : null}
            <kbd className={KEY}>{part}</kbd>
          </Fragment>
        );
      })}
    </span>
  );
}

/** A key table: each row's keys, any one of which works, and what they do. */
export function Keyboard({ data }: { data: KeyboardData }) {
  return (
    <div className="mt-16 overflow-x-auto first:mt-0">
      <table className="text-14/22 w-full border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="border-gray-6 text-12 font-500 text-gray-10 w-1 border-b-1 py-8 pr-24 text-left"
            >
              Key
            </th>
            <th
              scope="col"
              className="border-gray-6 text-12 font-500 text-gray-10 border-b-1 py-8 text-left"
            >
              Does
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((shortcut, row) => {
            return (
              <tr key={row}>
                <td className="border-gray-6 border-b-1 py-10 pr-24 align-top whitespace-nowrap">
                  <span className="inline-flex flex-wrap items-center gap-6">
                    {shortcut.keys.map((key, index) => {
                      return (
                        <Fragment key={index}>
                          {index > 0 ? <span className="text-12 text-gray-9">or</span> : null}
                          <Key value={key} />
                        </Fragment>
                      );
                    })}
                  </span>
                </td>
                <td className="border-gray-6 text-gray-11 border-b-1 py-10 align-top">
                  {shortcut.does}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
