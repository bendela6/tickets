import { useState } from 'react';
import { RichTextEditor, type SuggestionSource, type UploadImage } from '@bh/richtext/editor';

const PEOPLE = ['Ana Costa', 'Rui Lima', 'Inês Rocha'];

const people: SuggestionSource = {
  label: 'People',
  items: (query) => {
    return PEOPLE.filter((name) => name.toLowerCase().includes(query.toLowerCase())).map(
      (name) => ({ id: name, label: name }),
    );
  },
};

// Read the file in place of an upload, for the example.
const upload: UploadImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
};

export function EveryControl() {
  const [notes, setNotes] = useState('');
  return (
    <RichTextEditor
      label="Notes"
      features="full"
      suggestions={{ mention: people }}
      uploadImage={upload}
      value={notes}
      onChange={setNotes}
      placeholder="Every control the toolbar has…"
    />
  );
}
