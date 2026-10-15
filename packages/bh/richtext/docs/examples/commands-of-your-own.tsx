import { useState } from 'react';
import { RichTextEditor, SLASH_COMMANDS, type SlashCommand } from '@bh/richtext/editor';

const TODAY: SlashCommand = {
  id: 'today',
  label: 'Today’s date',
  keywords: ['date', 'now'],
  run: (editor) => {
    editor.chain().focus().insertContent(new Date().toDateString()).run();
  },
};

const COMMANDS = [TODAY, ...SLASH_COMMANDS];

export function CommandsOfYourOwn() {
  const [journal, setJournal] = useState('');
  return (
    <RichTextEditor
      label="Journal"
      features="full"
      slashCommands={COMMANDS}
      value={journal}
      onChange={setJournal}
      placeholder="Type /today…"
    />
  );
}
