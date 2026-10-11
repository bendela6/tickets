import { JsonViewer } from '@bh/ui';

export function WithoutTheChrome() {
  return (
    <JsonViewer
      value={{ file: 'photo.jpg', bytes: 148223 }}
      label="Attachment"
      toolbar={false}
      lineNumbers={false}
    />
  );
}
