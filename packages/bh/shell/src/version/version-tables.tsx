// The Version page's tables: services, and packages (the repo's own and the
// vendored copies' in one list). Each row says its version, the one before it
// when this release changed it, and when it last changed.

import type { ReactNode } from 'react';
import { AppLink } from './app-link';
import { shortName, type BuildInfo, type BuildPackage, type BuildService } from './build-info';
import { formatReleaseTime } from './release-time';

const TH =
  'text-11 text-gray-10 font-600 px-12 py-8 text-left tracking-wider uppercase whitespace-nowrap';
const TD = 'border-gray-4 px-12 py-10 align-top border-t-1';
const MONO = 'text-13 text-gray-12 font-mono font-500';
const SUB = 'text-12 text-gray-10 font-mono';

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="rounded-8 border-gray-6 bg-surface overflow-x-auto border-1">
      <table className="text-13 w-full min-w-560 border-collapse">
        <thead className="bg-gray-2">
          <tr>
            {head.map((h) => {
              return (
                <th key={h} scope="col" className={TH}>
                  {h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Name({ name, dir, self }: { name: string; dir?: string; self?: boolean }) {
  return (
    <>
      <div className={MONO}>
        {name}
        {self ? (
          <span className="text-12 font-500 text-indigo-11 ml-8 font-sans">this page</span>
        ) : null}
      </div>
      {dir ? <div className={SUB}>{dir}</div> : null}
    </>
  );
}

function Version({ version, previous }: { version: string; previous?: string }) {
  return (
    <>
      <span className={MONO}>{version}</span>
      {previous ? (
        <>
          <span className="text-11 font-600 bg-indigo-9 text-gray-1 ml-6 rounded-full px-6 py-2">
            new
          </span>
          <div className={SUB}>was {previous}</div>
        </>
      ) : null}
    </>
  );
}

function When({ iso, changed }: { iso: string; changed: boolean }) {
  return (
    <span
      className={
        changed ? 'whitespace-nowrap tabular-nums' : 'text-gray-10 whitespace-nowrap tabular-nums'
      }
    >
      {formatReleaseTime(iso)}
    </span>
  );
}

/** Service, version, last updated: the Overview's table. */
export function ServicesSummary({ info }: { info: BuildInfo }) {
  return (
    <Table head={['Service', 'Version', 'Last updated']}>
      {info.services.map((s) => {
        return (
          <tr key={s.name}>
            <td className={TD}>
              <Name name={s.name} self={s.name === info.self} />
            </td>
            <td className={TD}>
              <Version version={s.version} previous={s.previous} />
            </td>
            <td className={TD}>
              <When iso={s.releasedAt} changed={Boolean(s.previous)} />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function changedText(service: BuildService): string {
  if (!service.previous) {
    return 'Unchanged';
  }
  const n = service.commits ?? 0;
  return n === 0 ? 'From its packages' : `${n} commit${n === 1 ? '' : 's'}`;
}

/** Every service with its folder, versions, last update, this release's share and its notes. */
export function ServicesTable({ info, releasesPath }: { info: BuildInfo; releasesPath: string }) {
  return (
    <Table head={['Service', 'Version', 'Last updated', `In v${info.stack.version}`, 'Notes']}>
      {info.services.map((s) => {
        return (
          <tr key={s.name}>
            <td className={TD}>
              <Name name={s.name} dir={s.dir} self={s.name === info.self} />
            </td>
            <td className={TD}>
              <Version version={s.version} previous={s.previous} />
            </td>
            <td className={TD}>
              <When iso={s.releasedAt} changed={Boolean(s.previous)} />
            </td>
            <td className={s.previous ? TD : `${TD} text-gray-10`}>{changedText(s)}</td>
            <td className={`${TD} whitespace-nowrap`}>
              <AppLink
                to={releasesPath}
                search={{ service: shortName(s.name) }}
                className="text-indigo-11 hover:underline"
              >
                History
              </AppLink>
              {info.repository ? (
                <>
                  {' · '}
                  <a
                    href={`${info.repository}/blob/v${info.stack.version}/${s.dir}/CHANGELOG.md`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-11 hover:underline"
                  >
                    CHANGELOG.md ↗
                  </a>
                </>
              ) : null}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

/** Every package, the repo's own and the vendored copies', in one table. */
export function PackagesTable({ packages }: { packages: BuildPackage[] }) {
  return (
    <Table head={['Package', 'Version', 'Last updated', 'Used by']}>
      {packages.map((p) => {
        return (
          <tr key={p.name}>
            <td className={TD}>
              <Name name={p.name} dir={p.dir} />
            </td>
            <td className={TD}>
              <Version version={p.version} previous={p.previous} />
            </td>
            <td className={TD}>
              <When iso={p.releasedAt} changed={Boolean(p.previous)} />
            </td>
            <td className={`${TD} ${SUB}`}>{p.usedBy.length > 0 ? p.usedBy.join(', ') : '—'}</td>
          </tr>
        );
      })}
    </Table>
  );
}
