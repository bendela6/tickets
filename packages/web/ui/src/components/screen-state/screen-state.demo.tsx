import { definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style/tones';
import { ICON_NAMES } from '../icon/registry';
import { ScreenState } from './screen-state';

export const meta = { title: 'ScreenState', group: 'Ungrouped', size: 'lg' };

export const states = [
  {
    name: 'Error',
    render: () => (
      <ScreenState
        tone="danger"
        icon="triangle-alert"
        title="Couldn't load issues"
        body="The signals daemon isn't responding. Check that it's running, then try again."
        action={
          <button
            type="button"
            className="h-8 rounded-[8px] border border-gray-7 bg-surface-raised px-3.25 font-sans text-[12.5px] font-medium text-gray-12 hover:bg-surface-inset"
          >
            ↻ Retry
          </button>
        }
      />
    ),
  },
  {
    name: 'Empty (success)',
    render: () => (
      <ScreenState
        tone="success"
        icon="circle-check"
        title="No open issues 🎉"
        body="Everything reported in the last 14 days is resolved or ignored."
      />
    ),
  },
  {
    name: 'Empty (neutral)',
    render: () => (
      <ScreenState
        tone="neutral"
        icon="search"
        title="No items yet"
        body="Nothing here yet — create an item in any project."
      />
    ),
  },
  {
    name: 'Not found (no icon)',
    render: () => (
      <ScreenState
        title="Session not found"
        action={
          <a href="#" className="font-sans text-meta text-indigo-9 hover:underline">
            ‹ Back to Issues
          </a>
        }
      />
    ),
  },
];

export const playground = definePlayground({
  docs: {
    summary:
      'The block a screen shows instead of its content — empty, loading, error, no-results. One component for all four so the four never drift apart; the tone and icon are what tell them apart.',
  },
  controls: {
    title: text("Couldn't load issues", {
      type: 'ReactNode',
      required: true,
      description:
        'One line naming what happened, in the user’s terms. Not `Error` — say which thing failed.',
    }),
    icon: select(ICON_NAMES, {
      allowNone: true,
      initial: 'triangle-alert',
      type: 'IconName',
      description: 'Optional mark above the title, drawn in the state’s tone.',
    }),
    tone: select(TONE_NAMES, {
      initial: 'danger',
      type: 'Tone',
      description:
        'Colours the icon and frames the block. `danger` for failures, `neutral` for genuinely empty, `primary` while something is on its way.',
    }),
    body: text("The signals daemon isn't responding. Check that it's running, then try again.", {
      type: 'ReactNode',
      description:
        'What to do next, in a sentence. Leave it out when the title already says everything.',
    }),
  },
  render: (v) => (
    <ScreenState
      title={v.title}
      icon={v.icon}
      tone={v.tone}
      body={v.body === '' ? undefined : v.body}
    />
  ),
});
