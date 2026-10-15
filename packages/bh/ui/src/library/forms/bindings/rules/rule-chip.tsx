import { Fragment, type ReactNode } from 'react';
import { cn, focusRing } from '../../../../style';
import { Icon } from '../../../primitives/components/icon';
import { Pill } from '../../../primitives/components/pill';
import type { GroupParts, ValuePart } from './describe';
import { toneOf } from '../option-hues';

// One rule in the bar: 28 pixels high, the field's label in bold, the operator
// in its words, the values as pills in their options' colors, and an
// icon-only × named for the rule.

/** The chip's frame, shared with a group's, so the two sit level in the bar. */
export const chipClass =
  'inline-flex h-28 max-w-full items-center gap-5 rounded-5 border-1.5 pr-3 pl-9 text-12 font-sans whitespace-nowrap';

/** A chip that can be changed: a raised surface; one the page set is grey. */
export function chipSurface(locked: boolean): string {
  return locked
    ? 'border-gray-5 bg-gray-3 text-gray-11 pr-9'
    : 'border-gray-6 bg-surface-raised text-gray-12 shadow-sm';
}

/** The × that drops a rule, named for it. */
export function RemoveButton({ words, onRemove }: { words: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove filter: ${words}`}
      // The rules field moves the focus to the next one when this one goes.
      data-remove=""
      onClick={onRemove}
      className={cn(
        'rounded-4 text-gray-11 hover:bg-gray-4 hover:text-gray-12 inline-flex size-20 shrink-0 items-center justify-center',
        focusRing('indigo', 'focus-visible', 'inward'),
      )}
    >
      <Icon name="x" size="xs" />
    </button>
  );
}

/** The lock a rule the page set shows in place of its ×. */
export function LockMark() {
  return <Icon name="lock" size="xs" label="Set by the page" className="text-gray-9 shrink-0" />;
}

export interface RuleChipProps {
  /** The field's label: "Priority". */
  field: string;
  /** The operator in its words for the field: "is any of". */
  op: string;
  /** The values, each in its option's color. */
  values: readonly ValuePart[];
  /** The rule in words, which names its ×: "Priority is any of High, Urgent". */
  words: string;
  /** Set by the page: grey, with a lock and no ×. */
  readOnly?: boolean;
  /** Drops the rule; absent on a read-only one. */
  onRemove?: () => void;
  /** The chip's body as a control, which opens the rule: given the parts, draws them. */
  body?: (parts: ReactNode) => ReactNode;
}

/** One condition as a chip. */
export function RuleChip({ field, op, values, words, readOnly, onRemove, body }: RuleChipProps) {
  const parts = (
    <>
      <span className="font-600">{field}</span>
      <span className={readOnly ? undefined : 'text-gray-11'}>{op}</span>
      {values.map((value, index) => {
        return (
          <Pill
            key={`${index}:${value.label}`}
            size="sm"
            variant="subtle"
            tone={readOnly ? 'neutral' : (toneOf(value.color) ?? 'neutral')}
            label={value.label}
            className="font-500 max-w-160 tracking-normal"
          />
        );
      })}
    </>
  );
  return (
    <span className={cn(chipClass, chipSurface(readOnly ?? false))}>
      {readOnly ? <LockMark /> : null}
      {body && !readOnly ? (
        body(parts)
      ) : (
        <span className="inline-flex items-center gap-5">{parts}</span>
      )}
      {onRemove && !readOnly ? <RemoveButton words={words} onRemove={onRemove} /> : null}
    </span>
  );
}

/** The word between a group's parts: small capitals, as the chip's own words aren't. */
function Joint({ word }: { word: string }) {
  return <i className="text-10 font-600 text-gray-11 tracking-wide uppercase not-italic">{word}</i>;
}

export interface GroupChipProps extends GroupParts {
  /** The group in words, which names its ×: "Owner is me or Owner is empty". */
  words: string;
  /** Set by the page: a lock, and no ×. */
  readOnly?: boolean;
  /** Drops the group. */
  onRemove: () => void;
}

/**
 * An `any`, `all` or `not` group, which a view or the API may hold but a
 * filter form never writes: one grey chip that reads it in words. It can't be
 * opened, only removed.
 */
export function GroupChip({ joint, parts, words, readOnly, onRemove }: GroupChipProps) {
  return (
    <span
      title={words}
      className={cn(chipClass, 'bg-gray-3 text-gray-12 border-transparent', readOnly && 'pr-9')}
    >
      {readOnly ? (
        <LockMark />
      ) : (
        <Icon name="text-cursor" size="xs" className="text-gray-11 shrink-0" />
      )}
      {/* One line of text, so a long group ends in an ellipsis; its title says it all. */}
      <span className="min-w-0 truncate">
        {joint === 'not' ? (
          <>
            <Joint word="not" />{' '}
          </>
        ) : null}
        {parts.map((part, index) => {
          return (
            <Fragment key={`${index}:${part}`}>
              {index > 0 ? (
                <>
                  {' '}
                  <Joint word={joint} />{' '}
                </>
              ) : null}
              {part}
            </Fragment>
          );
        })}
      </span>
      {readOnly ? null : <RemoveButton words={words} onRemove={onRemove} />}
    </span>
  );
}
