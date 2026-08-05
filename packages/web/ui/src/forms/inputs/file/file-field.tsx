import type { InputProps } from '@tickets/form';
import { FileInput, type UploadFile } from '../../../components/inputs/file-input';

export type FileFieldConfig = {
  accept?: string;
  multiple?: boolean;
  /** Called with the newly picked files. Uploading belongs to the app — the
   *  form layer has no endpoint and no way to abort one. */
  onSelect?: (files: File[]) => void;
};

/** Attachments. The value is what to SHOW; the app owns the transfer and feeds
 *  progress and per-file errors back through it. */
export function FileField(p: InputProps<FileFieldConfig, UploadFile[]>) {
  return (
    <div onBlur={p.onBlur}>
      <FileInput
        id={p.name}
        value={p.value ?? []}
        accept={p.config.accept}
        multiple={p.config.multiple}
        onSelect={p.config.onSelect}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
