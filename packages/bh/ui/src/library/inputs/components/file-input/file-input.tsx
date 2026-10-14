import { useRef, useState } from 'react';
import { cn, focusRing, TONE_HUE } from '../../../../style';
import { Button } from '../../../primitives/components/button';
import { Icon } from '../../../primitives/components/icon';
import { Progress } from '../../../feedback/components/progress';
import { CONTROL_LADDER, type ControlProps, disabledTreatment } from '../../contract';

/**
 * A file as this control shows it — NOT the browser's `File`.
 *
 * Uploading belongs to the caller: it owns the endpoint, the retries and the
 * abort. So the control reports what was picked and renders whatever state the
 * caller reports back, rather than pretending to own a transfer it cannot see.
 */
export interface UploadFile {
  /** Tells the files apart: a removal drops the file with this id. */
  id: string;
  /** Shown in the list, and in the name of its remove button. */
  name: string;
  /** Bytes. Rendered as a readable size when present. */
  size?: number;
  /** 0–100 while a transfer is running; omit once it has settled. */
  progress?: number;
  /** Per file, not per control: one rejected file must not condemn the rest. */
  error?: string;
}

export type FileInputProps = Omit<ControlProps<UploadFile[]>, 'value' | 'onChange'> & {
  /** The files listed under the drop target, each with its size, progress or error. */
  value: UploadFile[];
  /** Removal, and any other change to the shown list. */
  onChange: (value: UploadFile[]) => void;
  /** New files chosen, by drop or by browse. The caller uploads them and feeds
   *  the result back through `value`. */
  onSelect?: (files: File[]) => void;
  /**
   * The file types the browse dialog offers, as the `accept` attribute takes
   * them: `image/*`, `.pdf`.
   *
   * A dropped file is not checked against it.
   */
  accept?: string;
  /** Whether several files can be chosen at once; `false` takes only the first file of a drop. */
  multiple?: boolean;
  /**
   * The drop target's accessible name, over a `<label htmlFor>` pointing at
   * `id`. With neither, the target is named by its own text.
   */
  label?: string;
};

/** `1536` → `1.5 KB`. Bytes are unreadable and every user knows their units. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/**
 * A drop target that is also a button.
 *
 * Both, not either: dropping is faster when you already have the file in a
 * window, and browsing is the only route for anyone not using a pointer. A
 * drop-only zone is unreachable by keyboard, and a button-only field ignores
 * the gesture most people try first.
 */
export function FileInput({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  onSelect,
  accept,
  multiple = true,
  label,
  size = 'md',
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: FileInputProps) {
  const hue = TONE_HUE[tone];
  const rung = CONTROL_LADDER[size];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const locked = disabled || readOnly;

  function pick(files: FileList | null) {
    if (!files || locked) {
      return;
    }
    const chosen = [...files];
    if (chosen.length > 0) {
      onSelect?.(multiple ? chosen : chosen.slice(0, 1));
    }
  }

  function remove(fileId: string) {
    if (locked) {
      return;
    }
    onChange(value.filter((file) => file.id !== fileId));
  }

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <button
        // The focusable part takes `id`, so a label names it, and a click on the
        // label goes through `onClick`, which a locked control refuses.
        id={id}
        aria-describedby={ariaDescribedBy}
        type="button"
        disabled={disabled}
        aria-disabled={readOnly || undefined}
        aria-label={label}
        onClick={() => !locked && inputRef.current?.click()}
        onDragOver={(event) => {
          if (locked) {
            return;
          }
          // Both are required for a drop to fire at all — the default is to
          // refuse, and forgetting either makes the target silently inert.
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-4 flex w-full flex-col items-center justify-center gap-4',
          'border-1 border-dashed px-16 py-24 transition-colors',
          rung.text,
          focusRing(hue, 'focus-visible', 'outward'),
          dragging
            ? // The whole target answers, not just its edge: a border that
              // changed alone is easy to miss while your eyes are on the file.
              `border-${hue}-9 bg-${hue}-2 text-${hue}-11`
            : 'border-gray-7 bg-gray-4 text-gray-11 hover:bg-gray-5',
          // The dim belongs to `disabled` alone. This read `locked`, so a
          // READ-ONLY drop target came out at 45% and grey — the inverse of
          // Rating's bug and just as wrong. A read-only file list is real data
          // at full contrast; it simply stops accepting drops.
          disabled && disabledTreatment,
          locked && 'hover:bg-gray-4 cursor-default',
        )}
      >
        <Icon name="file" size="sm" />
        <span>{dragging ? 'Drop to attach' : 'Drop files here, or click to browse'}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        // Only the button's click opens it. Taken out of the layout, the tab
        // order and the accessibility tree, with the button carrying the
        // affordance and the name.
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files);
          // Cleared so choosing the SAME file twice fires again — otherwise a
          // failed upload cannot be retried by re-picking it.
          event.target.value = '';
        }}
      />

      {value.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {value.map((file) => {
            return (
              <li
                key={file.id}
                className={cn(
                  'rounded-3 flex items-center gap-8 px-8 py-6',
                  file.error ? 'bg-red-2' : 'bg-gray-4',
                )}
              >
                <Icon name="file" size="xs" className="text-gray-9 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-12 text-gray-12 truncate font-sans">{file.name}</span>
                  {file.error ? (
                    // Per file. One rejected file must not condemn the rest.
                    <span className="text-11 text-red-11 font-sans">{file.error}</span>
                  ) : file.progress !== undefined ? (
                    <Progress
                      value={file.progress}
                      size="sm"
                      tone={tone}
                      aria-label={`Uploading ${file.name}`}
                      className="mt-2"
                    />
                  ) : file.size !== undefined ? (
                    <span className="text-11 text-gray-9 font-mono">{formatBytes(file.size)}</span>
                  ) : null}
                </span>
                {locked ? null : (
                  <Button
                    variant="ghost"
                    tone="neutral"
                    size="xs"
                    icon="x"
                    label={`Remove ${file.name}`}
                    onClick={() => remove(file.id)}
                    // A rung quieter than a ghost button's text: the row's own
                    // words come first.
                    className="text-gray-9"
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
