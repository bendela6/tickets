import { useState } from 'react';
import { AGENT_MODELS, PromptComposer } from './prompt-composer';

function ComposerFixture() {
  const [value, setValue] = useState('');
  const [model, setModel] = useState(AGENT_MODELS[0]!.value);
  const [effort, setEffort] = useState('medium');
  const [running, setRunning] = useState(true);
  return (
    <div className="flex w-full flex-col gap-8">
      <PromptComposer
        value={value}
        onChange={setValue}
        onSend={() => setValue('')}
        onInterrupt={() => setRunning(false)}
        running={running}
        model={model}
        onModelChange={setModel}
        effort={effort}
        onEffortChange={setEffort}
      />
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className="self-start font-sans text-12/17 text-indigo-9 hover:underline"
      >
        toggle running (Stop shows only while running)
      </button>
    </div>
  );
}

export const meta = { title: 'Prompt Composer', group: 'Ungrouped', size: 'full' };

export const states = [{ name: 'composer', render: () => <ComposerFixture /> }];
