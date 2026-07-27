import { boolean, definePlayground, text } from '../../gallery';
import { FieldLabel } from './field-label';
import { FieldError } from '../field-error';
import { Input } from '../input';

export const meta = { title: 'FieldLabel', group: 'Components', size: 'md' };

export const states = [
  {
    name: 'label + required',
    render: () => (
      <div className="w-56">
        <FieldLabel htmlFor="demo-key" required>
          Key
        </FieldLabel>
        <Input
          id="demo-key"
          defaultValue="core"
          invalid
          aria-describedby="demo-key-err"
          className="mt-1"
        />
        <FieldError id="demo-key-err">Key must be 2–24 chars, kebab-case</FieldError>
      </div>
    ),
  },
  {
    name: 'error text',
    render: () => (
      <FieldError>Key must be 2–24 chars, kebab-case</FieldError>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    children: text('Key'),
    required: boolean(true),
    error: text('Key must be 2–24 chars'),
  },
  render: ({ children, required, error }) => (
    <>
      <FieldLabel required={required}>{children}</FieldLabel>
      {error && <FieldError>{error}</FieldError>}
    </>
  ),
});
