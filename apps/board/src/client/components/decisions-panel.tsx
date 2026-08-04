import { Pill, Prose, ScreenState, type Tone } from '@tickets/ui';
import type { Decision, DecisionOption, DecisionStatus } from '../../shared/types';

// The richest object on the board. A decision is only useful with the reasoning that
// produced it, so every record carries its context, the question as asked, the options
// weighed, and which one won.
//
// The four option states must be distinguishable at a glance, and the one that matters
// most is `recommended` without `chosen` — a recommendation the user overruled. It has
// to read as information, never as an error.

const STATUS_TONE: Record<DecisionStatus, Tone> = {
  decided: 'success',
  open: 'warning',
  reversed: 'danger',
  superseded: 'neutral',
};

export function DecisionsPanel({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) {
    return <ScreenState title="Nothing settled in this session yet" />;
  }

  const tally = (status: DecisionStatus) =>
    decisions.filter((d) => (d.status ?? 'decided') === status).length;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap gap-6">
        {(['decided', 'open', 'reversed', 'superseded'] as DecisionStatus[])
          .filter((s) => tally(s) > 0)
          .map((s) => (
            <Pill key={s} label={`${tally(s)} ${s}`} tone={STATUS_TONE[s]} size="sm" />
          ))}
      </div>
      {decisions.map((d) => (
        <DecisionCard key={d.id} decision={d} />
      ))}
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const status = decision.status ?? 'decided';
  const spent = status === 'superseded' || status === 'reversed';

  return (
    <article
      className={[
        'min-w-0 overflow-hidden rounded-lg border bg-surface-raised',
        status === 'open' ? 'border-orange-7' : 'border-gray-6',
        spent ? 'opacity-70' : '',
      ].join(' ')}
    >
      <header className="flex items-center gap-10 border-gray-6 border-b px-14 py-10">
        {decision.icon ? (
          <span aria-hidden className="text-15">
            {decision.icon}
          </span>
        ) : null}
        <h3 className="min-w-0 flex-1 truncate font-semibold text-13 text-gray-12">
          {decision.topic ?? decision.decided ?? 'Decision'}
        </h3>
        <Pill label={status} tone={STATUS_TONE[status]} size="sm" />
        <span className="shrink-0 font-mono text-11 text-gray-11">#{decision.id}</span>
      </header>

      <div className="px-14 py-12">
        {decision.context ? (
          <>
            <Label>Context</Label>
            <Prose className="mb-12">{decision.context}</Prose>
          </>
        ) : null}

        {decision.question ? (
          <>
            <Label>Question</Label>
            <p className="mb-12 border-indigo-8 border-l-2 pl-10 font-semibold text-13/19 text-gray-12">
              {decision.question}
            </p>
          </>
        ) : null}

        {decision.options && decision.options.length > 0 ? (
          <>
            <Label>Options considered</Label>
            <ul className="mb-12 flex flex-col gap-4">
              {decision.options.map((o) => (
                <OptionRow key={o.label} option={o} />
              ))}
            </ul>
          </>
        ) : null}

        {decision.decided ? (
          // The outcome box carries the decision's standing, not just its existence:
          // a superseded or reversed choice must not read as still in force.
          <div
            className={[
              'rounded-md border px-12 py-8',
              status === 'open'
                ? 'border-orange-7 bg-orange-3'
                : status === 'decided'
                  ? 'border-green-7 bg-green-3'
                  : 'border-gray-6 bg-surface-inset',
            ].join(' ')}
          >
            <p className="font-semibold text-13 text-gray-12">{decision.decided}</p>
            {decision.rationale ? (
              <div className="mt-6 border-gray-6 border-t border-dashed pt-6">
                <Prose>{decision.rationale}</Prose>
              </div>
            ) : null}
          </div>
        ) : null}

        {decision.supersededBy ? (
          <p className="mt-8 text-12 text-orange-11">
            Superseded by decision #{decision.supersededBy}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function OptionRow({ option }: { option: DecisionOption }) {
  const { chosen, recommended } = option;
  return (
    <li
      className={[
        'flex min-w-0 gap-8 rounded-md border px-10 py-6',
        chosen
          ? 'border-green-7 bg-green-3'
          : recommended
            ? 'border-indigo-7 bg-indigo-3'
            : 'border-transparent opacity-70',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-6">
          <span
            className={['text-13 text-gray-12', chosen ? 'font-semibold' : ''].join(' ')}
          >
            {option.label}
          </span>
          {recommended ? <Pill label="recommended" tone="primary" size="sm" /> : null}
          {chosen ? <Pill label="chosen" tone="success" size="sm" /> : null}
        </span>
        {option.detail ? (
          <span className="mt-2 block text-12/17 text-gray-11">{option.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

function Label({ children }: { children: string }) {
  return (
    <p className="mb-4 font-semibold text-10 text-gray-11 uppercase tracking-wider">{children}</p>
  );
}
