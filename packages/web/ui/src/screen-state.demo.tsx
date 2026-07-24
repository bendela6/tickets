import { definePlayground, select, text } from './gallery';
import { TONE_NAMES } from './tones';
import { ICON_NAMES } from './icons/registry';
import { ScreenState } from './screen-state';

export const meta = { title: 'ScreenState', group: 'Display', size: 'lg' };

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
            className="h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:bg-inset"
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
          <a href="#" className="font-sans text-meta text-accent hover:underline">
            ‹ Back to Issues
          </a>
        }
      />
    ),
  },
];

export const playground = definePlayground({
  controls: {
    title: text("Couldn't load issues"),
    icon: select(ICON_NAMES, { allowNone: true, initial: 'triangle-alert' }),
    tone: select(TONE_NAMES, { initial: 'danger' }),
    body: text("The signals daemon isn't responding. Check that it's running, then try again."),
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
