import { useState } from 'react';
import { cn, Input, Kbd } from '@bh/ui';

export function AnAddInput() {
  const [tasks, setTasks] = useState(['Book the room', 'Send the agenda']);
  const [typing, setTyping] = useState(false);
  return (
    <div className="flex w-256 flex-col gap-8">
      <ul className="text-13/19 text-gray-12 flex flex-col gap-4 font-sans">
        {tasks.map((task, index) => {
          return <li key={`${index}-${task}`}>{task}</li>;
        })}
      </ul>
      <Input
        aria-label="New task"
        placeholder="+ Add a task"
        // Always empty: each commit adds a task, and the field shows this again.
        value=""
        commit="leave"
        onDraft={(draft) => setTyping(draft.trim() !== '')}
        onChange={(next) => {
          const task = next.trim();
          if (task !== '') {
            setTasks((current) => [...current, task]);
          }
          setTyping(false);
        }}
        trailing={<Kbd keys="enter" className={cn('shrink-0', !typing && 'invisible')} />}
      />
    </div>
  );
}
