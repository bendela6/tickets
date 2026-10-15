import { useState } from 'react';
import { RichTextEditor, type SuggestionItem } from '@bh/richtext/editor';

const CITIES = ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Évora'];

// As a request would: the list says it is looking until this resolves.
function search(query: string): Promise<SuggestionItem[]> {
  const typed = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        CITIES.filter((city) => city.toLowerCase().startsWith(typed)).map((city) => {
          return {
            id: city,
            label: city,
          };
        }),
      );
    }, 600);
  });
}

export function FromTheServer() {
  const [note, setNote] = useState('');
  return (
    <RichTextEditor
      label="Itinerary"
      features="compact"
      suggestions={{ mention: { label: 'Cities', items: search } }}
      value={note}
      onChange={setNote}
      placeholder="Type @ to name a city…"
    />
  );
}
