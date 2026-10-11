import type { ErrorCardProps } from './render';

/**
 * What a reader sees where a block should have been: that nothing rendered,
 * what, and why, one reason a line in the validator's own words. A host hands
 * it to `DocView` as `elements.errorCard`.
 */
export function BlockErrorCard({ title, reasons }: ErrorCardProps) {
  return (
    <div
      role="alert"
      className="rounded-6 border-red-6 bg-red-2 mt-16 border-1 px-16 py-12 first:mt-0"
    >
      <p className="text-11 font-600 text-red-11 tracking-[0.04em] uppercase">Block not rendered</p>
      <p className="text-15/22 font-600 text-gray-12 mt-2">{title}</p>
      {reasons.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {reasons.map((reason, index) => {
            return (
              <li key={index} className="text-12/18 text-gray-11 font-mono">
                {reason}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
