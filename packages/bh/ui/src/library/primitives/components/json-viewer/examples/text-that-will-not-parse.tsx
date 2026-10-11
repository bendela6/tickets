import { useState } from 'react';
import { JsonViewer } from '@bh/ui';

export function TextThatWillNotParse() {
  const [text, setText] = useState('{\n  "city": "Oslo",\n  "rivers":,\n  "coastal": true\n}');
  return <JsonViewer source={text} onChange={setText} label="oslo.json" />;
}
