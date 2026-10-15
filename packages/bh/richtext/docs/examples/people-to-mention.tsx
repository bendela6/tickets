import { useState } from 'react';
import { Avatar } from '@bh/ui';
import { RichTextEditor, type SuggestionItem } from '@bh/richtext/editor';

const PEOPLE = [
  { id: 1, name: 'Ana Costa', handle: 'ana' },
  { id: 2, name: 'Rui Lima', handle: 'rui' },
  { id: 3, name: 'Inês Rocha', handle: 'ines' },
  { id: 4, name: 'Tomás Reis', handle: 'tomas' },
];

function people(query: string): SuggestionItem[] {
  const typed = query.toLowerCase();
  return PEOPLE.filter((person) => {
    return person.name.toLowerCase().includes(typed) || person.handle.startsWith(typed);
  }).map((person) => {
    return {
      id: person.id,
      label: person.name,
      description: `@${person.handle}`,
      leading: <Avatar name={person.name} size="xs" />,
    };
  });
}

export function PeopleToMention() {
  const [note, setNote] = useState('Type @ and a name: ');
  return (
    <RichTextEditor
      label="Note"
      features="compact"
      suggestions={{ mention: { label: 'People', items: people } }}
      value={note}
      onChange={setNote}
    />
  );
}
