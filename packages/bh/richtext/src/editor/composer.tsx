import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { ReactNode } from 'react';
import { Button, cn, Kbd, type ButtonSize, type ControlSize } from '@bh/ui';
import { toolbarPadding } from './toolbar';

/**
 * The editor as a composer, a comment box: its toolbar in a row under the
 * text, beside a submit button and a ⌘↩ hint, and ⌘↩ (Ctrl+Enter elsewhere)
 * sending the text rather than breaking the line.
 */
export interface Composer {
  /**
   * Sends the text: the live document's JSON, as `onChange` reports it, read
   * at the press, so it never waits on the page to catch up. Never called
   * while the text holds nothing. The page clears the editor, once it is sent,
   * by setting `value` to `''`.
   */
  onSubmit: (value: string) => void;
  /** The submit button's words. By default "Send". */
  submitLabel?: string;
  /** While the text is on its way: the button shows it, and nothing sends again. */
  submitPending?: boolean;
  /** Whether sending is off: the button is, and ⌘↩ does nothing. */
  submitDisabled?: boolean;
}

/** Whether a key press is the composer's submit: Enter with ⌘, or with Ctrl. */
function isSubmitKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

export interface SubmitShortcutOptions {
  /**
   * Takes ⌘↩: true when the editor is a composer, which swallows the key
   * whether or not it sends, so it never breaks the line; false otherwise.
   */
  submit: (event: KeyboardEvent) => boolean;
}

/**
 * ⌘↩ for the composer. Its priority puts it ahead of the hard break, which
 * binds the same keys; an editor that is no composer leaves the keys to it.
 */
export const SubmitShortcut = Extension.create<SubmitShortcutOptions>({
  name: 'composerSubmit',
  priority: 1000,
  addOptions() {
    return { submit: () => false };
  },
  addProseMirrorPlugins() {
    const { submit } = this.options;
    return [
      new Plugin({
        key: new PluginKey('composerSubmit'),
        props: {
          handleKeyDown: (_view, event) => isSubmitKey(event) && submit(event),
        },
      }),
    ];
  },
});

/** The button and the hint, a step under the toolbar's height. */
const BUTTON: Record<ControlSize, ButtonSize> = { xs: 'sm', md: 'sm', lg: 'md' };
const HINT: Record<ControlSize, 'sm' | 'md'> = { xs: 'sm', md: 'sm', lg: 'md' };

export interface ComposerRowProps {
  composer: Composer;
  size: ControlSize;
  /** The toolbar, while the text can be edited. */
  toolbar: ReactNode;
  /** Whether the editor is disabled, which turns its button off too. */
  disabled: boolean;
  onSubmit: () => void;
}

/** The row under a composer's text: its toolbar, the ⌘↩ hint, and the submit button. */
export function ComposerRow({ composer, size, toolbar, disabled, onSubmit }: ComposerRowProps) {
  return (
    <div
      className={cn('border-gray-7 flex items-center gap-8 border-t-1', toolbarPadding(size))}
      data-rt-composer=""
    >
      {toolbar}
      {/* The button carries the shortcut for a screen reader; the hint is for the eye. */}
      <Kbd keys="mod+enter" variant="text" size={HINT[size]} aria-hidden className="ml-auto" />
      <Button
        variant="solid"
        size={BUTTON[size]}
        disabled={disabled || composer.submitDisabled === true}
        loading={composer.submitPending === true}
        aria-keyshortcuts="Meta+Enter Control+Enter"
        onClick={onSubmit}
      >
        {composer.submitLabel ?? 'Send'}
      </Button>
    </div>
  );
}
