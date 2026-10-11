import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function MoreRows() {
  const [message, setMessage] = useState('');
  return (
    <div className="w-288">
      <Textarea
        aria-label="Message"
        placeholder="Write a message"
        value={message}
        onChange={setMessage}
        rows={6}
        maxLength={500}
      />
    </div>
  );
}
