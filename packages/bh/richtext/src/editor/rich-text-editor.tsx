import { getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  cn,
  CONTROL_LADDER,
  disabledTreatment,
  fieldClass,
  fieldState,
  readOnlyFieldClass,
  type ControlProps,
  type ControlSize,
} from '@bh/ui';
import { DOC_SENTINEL, parseDoc, type DocNode } from '../detect';
import { PRESETS, type Feature } from '../features';
import { createRichText, type RichText } from '../rich-text';
import { ComposerRow, SubmitShortcut, type Composer } from './composer';
import { ImageUpload, useImageUploads, type UploadImage } from './image-upload';
import { LinkPopover, LinkShortcut } from './link-popover';
import {
  SLASH_COMMANDS,
  slashCommands as slashExtension,
  suggestionHooks,
  useSuggestionList,
  type SlashCommand,
  type SuggestionSource,
} from './suggestions';
import { Toolbar } from './toolbar';

export interface RichTextEditorProps extends ControlProps<string> {
  /**
   * The text: a document as the editor writes it (its JSON), or markdown,
   * which it reads as a document. Each edit is reported as the document's
   * JSON, and an editor holding nothing reports `''`. A new value from the
   * page replaces what it holds, and isn't reported back as an edit.
   */
  value: string;
  /**
   * What it can do: `full` for a document, `compact` for a comment, or the
   * features one by one. Another list makes the editor again.
   */
  features?: keyof typeof PRESETS | readonly Feature[];
  /**
   * The app's rich text, from `createRichText({ nodes })`, so its own inline
   * nodes are in the editor and in the documents it reads. By default the
   * package's, with mentions alone. Make it once, outside the component:
   * another one makes the editor again.
   */
  richText?: RichText;
  /** Shown while it holds nothing, disabled or read-only too. */
  placeholder?: string;
  /** Its accessible name. */
  label?: string;
  /** The id of the element naming it, as a field's label does; wins over `label`. */
  labelledBy?: string;
  /**
   * What each inline node's trigger suggests, by the node's name: `mention`
   * for `@`, and an app's own by theirs (tickets' `ticketRef`, for `#`).
   * A node with no source opens no list. Read as it is typed, so a new one
   * needs no new editor.
   */
  suggestions?: Readonly<Record<string, SuggestionSource>>;
  /**
   * The `/` list of commands: `true` for bh's own (`SLASH_COMMANDS`), or
   * the app's list, which may hold bh's too. Only those the features allow
   * are offered. Off by default.
   */
  slashCommands?: boolean | readonly SlashCommand[];
  /**
   * Where images go: the app takes a file, reports how far along it is, and
   * resolves to the address it is shown from. With the `image` feature,
   * images pasted, dropped or picked (the toolbar's Image, `/` Image) go up
   * through it, each held in its place, with its progress, until it is there;
   * a failed one says so, with Retry and Remove. Without it, no image upload
   * is offered.
   */
  uploadImage?: UploadImage;
  /**
   * Makes it a composer, a comment box: the toolbar moves to a row under the
   * text, beside a submit button and a ⌘↩ hint, and ⌘↩ (Ctrl+Enter
   * elsewhere) sends the live document through `onSubmit` rather than
   * breaking the line. Nothing sends while the text holds nothing, while
   * pending or disabled, nor again on a held key's repeats.
   */
  composer?: Composer;
}

/** Rich text with mentions and no inline nodes of an app's own. */
const PLAIN = createRichText();

/** The `/` commands an editor offers: those of its list its features allow. */
function offered(
  slash: RichTextEditorProps['slashCommands'],
  features: readonly Feature[],
  uploads: boolean,
): readonly SlashCommand[] {
  const commands = slash === true ? SLASH_COMMANDS : slash === false ? [] : (slash ?? []);
  // An image comes in only through an upload.
  const usable = uploads ? features : features.filter((feature) => feature !== 'image');
  return commands.filter((command) => {
    return command.feature === undefined || usable.includes(command.feature);
  });
}

/**
 * Starts an `@` mention at the caret, a space before it where the text
 * before would run into it: a trigger opens its list only after a space.
 */
function startMention(editor: Editor) {
  const { from, $from } = editor.state.selection;
  const before =
    $from.parentOffset > 0 ? editor.state.doc.textBetween(from - 1, from, '', '￼') : '';
  editor
    .chain()
    .focus()
    .insertContent(before === '' || /s/.test(before) ? '@' : ' @')
    .run();
}

/** How many reported values the editor waits to see come back as `value`. */
const MAX_ECHOES = 32;

/**
 * Each size's floor and the space above and below the text, as a textarea's:
 * about two, three and four lines. The space beside it is the ladder's.
 */
const BOX: Record<ControlSize, { floor: string; padY: string }> = {
  xs: { floor: 'min-h-56', padY: 'py-8' },
  md: { floor: 'min-h-72', padY: 'py-10' },
  lg: { floor: 'min-h-88', padY: 'py-12' },
};

/** A composer's floor: a line or two, since its row under the text adds its own height. */
const COMPOSER_FLOOR: Record<ControlSize, string> = {
  xs: 'min-h-36',
  md: 'min-h-44',
  lg: 'min-h-52',
};

function featureList(features: RichTextEditorProps['features']): readonly Feature[] {
  return typeof features === 'string' ? PRESETS[features] : (features ?? PRESETS.full);
}

/** The editor's document, as `@bh/richtext` reads one: Tiptap's JSON, whose `type` it always sets. */
function docOf(editor: Editor): DocNode {
  return editor.getJSON() as DocNode;
}

/** The value a document stands for: its JSON, or `''` when it holds nothing. */
function valueOf(richText: RichText, doc: DocNode): string {
  return richText.isDocEmpty(doc) ? '' : JSON.stringify(doc);
}

/**
 * The document to load for a value. One that holds what these features leave
 * out (a heading, in a comment) is no document to the editor, and Tiptap would
 * load it empty, so the next edit would write over every word of it: it loads
 * as its plain text instead, a paragraph a line.
 */
function loadable(richText: RichText, schema: Schema, value: string): DocNode {
  const doc = richText.toDisplayDoc(value);
  try {
    schema.nodeFromJSON(doc);
    return doc;
  } catch (error) {
    console.warn(
      `RichTextEditor: the text holds what this editor's features leave out (${String(error)}), so it shows as plain text.`,
    );
    const lines = richText.docToText(doc).split('\n');
    return {
      type: 'doc',
      content: lines.map((line) => {
        return { type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] };
      }),
    };
  }
}

interface Naming {
  id?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  placeholder?: string;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  size: ControlSize;
  /** The open suggestion list, and the row under its cursor. */
  listId?: string;
  activeId?: string;
}

/**
 * What the editable area says about itself: a multi-line textbox, its id, its
 * name, its state, and the space around the text. It fills the box, so a press
 * anywhere in it lands in the text.
 */
function attributesOf(naming: Naming): Record<string, string> {
  const {
    id,
    label,
    labelledBy,
    describedBy,
    placeholder,
    disabled,
    readOnly,
    invalid,
    size,
    listId,
    activeId,
  } = naming;
  const attrs: Record<string, string> = {
    'aria-multiline': 'true',
    class: cn(
      'flex-1 outline-none',
      // A read-only field is a printed row: the box keeps no padding of its own.
      readOnly ? 'px-0' : CONTROL_LADDER[size].padX,
      BOX[size].padY,
    ),
  };
  if (id) {
    attrs.id = id;
  }
  if (labelledBy) {
    attrs['aria-labelledby'] = labelledBy;
  } else if (label) {
    attrs['aria-label'] = label;
  }
  if (describedBy) {
    attrs['aria-describedby'] = describedBy;
  }
  if (placeholder) {
    attrs['aria-placeholder'] = placeholder;
  }
  if (invalid) {
    attrs['aria-invalid'] = 'true';
  }
  // While a suggestion list is open, the text points at it and at the row the
  // arrows are on, as a combobox's input does.
  if (listId) {
    attrs['aria-controls'] = listId;
  }
  if (activeId) {
    attrs['aria-activedescendant'] = activeId;
  }
  if (disabled) {
    attrs['aria-disabled'] = 'true';
  }
  // Read-only keeps its tab stop, as a read-only field does; nothing else
  // gives a text the editor isn't editing one.
  if (readOnly) {
    attrs['aria-readonly'] = 'true';
    attrs.tabindex = '0';
  }
  return attrs;
}

/**
 * Rich text being written: Tiptap's editor, on a field's floor. It holds a
 * document, takes markdown for one, and reports each edit as the document's
 * JSON, so a form stores it as text. The features say what it can do, and its
 * toolbar shows them, while it can be edited; an app's own inline nodes come in
 * with its `richText`.
 *
 * As every bh control: `tone` colours it (`danger` sets `aria-invalid`),
 * `disabled` fades it and takes it out of the tab order, and `readOnly` shows
 * the text as a printed row, still focusable. The editable area is a
 * multi-line `textbox` named by `label` or `labelledBy`; a `<label htmlFor>`
 * can't name it, since it's no form control.
 */
export function RichTextEditor({
  value,
  onChange,
  features,
  richText = PLAIN,
  placeholder,
  label,
  labelledBy,
  suggestions,
  slashCommands,
  uploadImage,
  composer,
  id,
  'aria-describedby': describedBy,
  size = 'md',
  tone,
  disabled = false,
  readOnly = false,
  className,
}: RichTextEditorProps) {
  const field = fieldState(tone);
  const editable = !disabled && !readOnly;
  // The value the editor holds: the one it last loaded from the page, or the
  // one it last reported.
  const held = useRef(value);
  // The values it has reported that haven't come back as `value` yet. The page
  // can render a few edits behind the typing, so an earlier one coming back is
  // an echo as much as the latest: loading it would undo what came after.
  const echoes = useRef<string[]>([]);
  // The placeholder is read on every redraw, so a new one needs no new editor.
  const shown = useRef(placeholder);
  // Whether the link popup is open for writing an address.
  const [linking, setLinking] = useState(false);
  // The open suggestion list, and what each trigger and `/` offer, read as they are typed.
  const { renderer, list: suggestionList, listId, activeId } = useSuggestionList();
  const sources = useRef(suggestions);
  const commands = useRef<readonly SlashCommand[]>([]);
  // Where images go, and the uploads' own handlers, which the editor's
  // extension reaches through this, since they come after it.
  const upload = useRef(uploadImage);
  const uploads = useRef<{ files: (files: File[], at?: number) => boolean; pick: () => boolean }>({
    files: () => false,
    pick: () => false,
  });
  // The composer's submit, which ⌘↩ reaches through this, since the editor's
  // extension comes before it. False while the editor is no composer.
  const submitter = useRef<(event?: KeyboardEvent) => boolean>(() => false);
  // Set once a text is sent, until the page says it is no longer pending, or
  // the text changes: two presses before the page catches up send it once.
  const sent = useRef(false);

  // The features are read by name, so a list spelled again each render keeps
  // its editor.
  const featureKey = featureList(features).join(' ');
  // What the editor is made from, and made again from when it changes. It
  // starts from what it holds, so a new feature list keeps the text.
  const made = useMemo(() => {
    const list = featureList(features);
    const extensions = [
      ...richText.buildExtensions(list, suggestionHooks(richText.nodeNames, sources, renderer), {
        placeholder: () => shown.current ?? '',
      }),
      slashExtension(commands, renderer),
      // ⌘K opens the link popup, as the toolbar's Link does.
      ...(list.includes('link') ? [LinkShortcut.configure({ open: () => setLinking(true) })] : []),
      // ⌘↩ sends a composer's text.
      SubmitShortcut.configure({ submit: (event) => submitter.current(event) }),
      ...(list.includes('image')
        ? [
            ImageUpload.configure({
              files: (files, at) => uploads.current.files(files, at),
              pick: () => uploads.current.pick(),
            }),
          ]
        : []),
    ];
    const schema = getSchema(extensions);
    return {
      features: list,
      extensions,
      schema,
      content: loadable(richText, schema, held.current),
    };
  }, [featureKey, richText, renderer]);

  useLayoutEffect(() => {
    sources.current = suggestions;
    commands.current = offered(slashCommands, made.features, uploadImage !== undefined);
    upload.current = uploadImage;
  });

  const attributes = useMemo(() => {
    return attributesOf({
      id,
      label,
      labelledBy,
      describedBy,
      placeholder,
      disabled,
      readOnly,
      invalid: field.invalid,
      size,
      listId,
      activeId,
    });
  }, [
    id,
    label,
    labelledBy,
    describedBy,
    placeholder,
    disabled,
    readOnly,
    field.invalid,
    size,
    listId,
    activeId,
  ]);

  const editor = useEditor(
    {
      extensions: made.extensions,
      content: made.content,
      editable,
      // Made in the first render in a browser, so the text is there at once;
      // on a server, where a page is rendered to HTML, not at all.
      immediatelyRender: typeof window !== 'undefined',
      editorProps: { attributes },
      onUpdate: ({ editor: current, transaction }) => {
        if (!transaction.docChanged) {
          return;
        }
        const next = valueOf(richText, docOf(current));
        if (next === held.current) {
          return;
        }
        held.current = next;
        sent.current = false;
        // A page that never takes the value back keeps no more than a few.
        echoes.current = [...echoes.current.slice(1 - MAX_ECHOES), next];
        onChange(next);
      },
    },
    [made],
  );

  // Images on their way up: the file picker, and a card in each one's place.
  const images = useImageUploads(editor, upload);
  useLayoutEffect(() => {
    uploads.current = { files: images.files, pick: images.pick };
  });
  const uploading = uploadImage !== undefined && made.features.includes('image');

  // A new value from the page replaces the document, without an update: it is
  // no edit. One the editor reported is its own edit come back.
  useEffect(() => {
    const echo = echoes.current.indexOf(value);
    if (echo !== -1) {
      echoes.current = echoes.current.slice(echo + 1);
      return;
    }
    if (editor === null || editor.isDestroyed || value === held.current) {
      return;
    }
    held.current = value;
    echoes.current = [];
    sent.current = false;
    editor.commands.setContent(loadable(richText, made.schema, value), { emitUpdate: false });
  }, [editor, value, richText, made]);

  // A composer sends the live document, read at the press. ⌘↩ is the
  // composer's whatever it does, so it never breaks the line.
  useLayoutEffect(() => {
    submitter.current = (event) => {
      if (composer === undefined) {
        return false;
      }
      if (event?.repeat === true || composer.submitDisabled === true) {
        return true;
      }
      if (composer.submitPending === true || sent.current) {
        return true;
      }
      if (editor === null || editor.isDestroyed || !editor.isEditable) {
        return true;
      }
      const next = valueOf(richText, docOf(editor));
      if (next !== '') {
        sent.current = true;
        composer.onSubmit(next);
      }
      return true;
    };
  });

  // Sent and no longer pending: the next text can go.
  const pending = composer?.submitPending === true;
  useEffect(() => {
    if (!pending) {
      sent.current = false;
    }
  }, [pending]);

  // A stored document that no longer parses shows as its text; say so once,
  // so the damage doesn't go unnoticed.
  useEffect(() => {
    if (value.startsWith(DOC_SENTINEL) && parseDoc(value) === null) {
      console.error(
        `RichTextEditor: the stored document doesn't parse (${String(value.length)} characters), so it shows as text.`,
      );
    }
  }, [value]);

  // The editor is made once for its features; what changes after reaches it here.
  useEffect(() => {
    if (!editable) {
      setLinking(false);
    }
  }, [editable]);

  useEffect(() => {
    if (editor !== null && !editor.isDestroyed && editor.isEditable !== editable) {
      // No update: being locked or unlocked changes nothing in the text.
      editor.setEditable(editable, false);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor !== null && !editor.isDestroyed) {
      editor.setOptions({ editorProps: { attributes } });
    }
  }, [editor, attributes]);

  useEffect(() => {
    shown.current = placeholder;
    if (editor !== null && !editor.isDestroyed) {
      // The placeholder is a decoration, drawn again on a transaction: an
      // empty one draws the new one.
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, placeholder]);

  const toolbar = (placement: 'top' | 'row') => {
    if (!editable || editor === null) {
      return null;
    }
    return (
      <Toolbar
        editor={editor}
        features={made.features}
        size={size}
        placement={placement}
        actions={{
          link: () => setLinking(true),
          linking,
          mention: suggestions?.['mention'] ? () => startMention(editor) : undefined,
          image: uploading ? images.pick : undefined,
        }}
      />
    );
  };

  return (
    <div
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        // The text holds the focus, inside the box: the ring answers to it.
        focus: 'focus-within',
        className: cn(
          // It grows with its text: the ladder's height becomes a floor, and
          // the space around the text is the editable area's own.
          'flex h-auto w-full flex-col p-0',
          disabled && disabledTreatment,
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      {/* Only while it can be edited: a disabled or read-only text has nothing to format. */}
      {composer === undefined ? toolbar('top') : null}
      <EditorContent
        editor={editor}
        className={cn('rt flex flex-1 flex-col', composer ? COMPOSER_FLOOR[size] : BOX[size].floor)}
      />
      {/* A read-only text sends nothing. */}
      {composer !== undefined && !readOnly ? (
        <ComposerRow
          composer={composer}
          size={size}
          toolbar={toolbar('row')}
          disabled={disabled}
          onSubmit={() => submitter.current()}
        />
      ) : null}
      {editable && editor !== null && made.features.includes('link') ? (
        <LinkPopover editor={editor} editing={linking} onEditingChange={setLinking} />
      ) : null}
      {suggestionList}
      {uploading ? images.picker : null}
      {images.cards}
    </div>
  );
}
