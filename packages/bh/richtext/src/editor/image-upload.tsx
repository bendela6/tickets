import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension, type Editor } from '@tiptap/react';
import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, Progress, Spinner } from '@bh/ui';

/**
 * Where the app puts an image: it takes the file, reports how far along it is
 * (0 to 100) if it can, and resolves to the address the image is shown from.
 * A rejection is a failed upload, its message shown.
 */
export type UploadImage = (file: File, progress: (percent: number) => void) => Promise<string>;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      /** Opens the file picker for images, which go where the app uploads them. */
      pickImage: () => ReturnType;
    };
  }
}

const placesKey = new PluginKey<DecorationSet>('imageUploadPlaces');

type PlaceMeta = { add: { id: string; pos: number; dom: HTMLElement } } | { remove: string };

/** An upload's place: a widget, the card drawn into its element, before what follows it. */
function widget(id: string, pos: number, dom: HTMLElement): Decoration {
  return Decoration.widget(pos, dom, {
    key: id,
    upload: id,
    side: -1,
    // The card's buttons are the card's: the text doesn't take their presses.
    stopEvent: () => true,
    ignoreSelection: true,
  });
}

const isUpload = (id: string) => (spec: { upload?: string }) => spec.upload === id;

/**
 * Where each upload in flight will land: a widget in the text, never a node,
 * so the document never holds an image that isn't there yet. Edits around it
 * move it along; one that deletes the text it sat in puts it back at the
 * nearest place, rather than losing the upload.
 */
function uploadPlaces(): Plugin<DecorationSet> {
  const places = new Map<string, { pos: number; dom: HTMLElement }>();
  return new Plugin<DecorationSet>({
    key: placesKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr: Transaction, old: DecorationSet): DecorationSet {
        let set = old.map(tr.mapping, tr.doc);
        for (const [id, place] of places) {
          const [found] = set.find(undefined, undefined, isUpload(id));
          if (found) {
            place.pos = found.from;
          } else {
            place.pos = Math.max(0, Math.min(tr.doc.content.size, tr.mapping.map(place.pos, -1)));
            set = set.add(tr.doc, [widget(id, place.pos, place.dom)]);
          }
        }
        const meta = tr.getMeta(placesKey) as PlaceMeta | undefined;
        if (meta && 'add' in meta) {
          places.set(meta.add.id, { pos: meta.add.pos, dom: meta.add.dom });
          set = set.add(tr.doc, [widget(meta.add.id, meta.add.pos, meta.add.dom)]);
        } else if (meta) {
          places.delete(meta.remove);
          set = set.remove(set.find(undefined, undefined, isUpload(meta.remove)));
        }
        return set;
      },
    },
    props: {
      decorations: (state) => placesKey.getState(state) ?? null,
    },
  });
}

/** Where an upload will land now, or `null` once it has no place. */
export function placeOf(state: EditorState, id: string): number | null {
  const [found] = placesKey.getState(state)?.find(undefined, undefined, isUpload(id)) ?? [];
  return found?.from ?? null;
}

/** The images among some files. */
function imagesIn(files: FileList | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
}

interface ImageUploadOptions {
  /** Takes images in at a position, or at the caret; says whether it did. */
  files: (files: File[], at?: number) => boolean;
  /** Opens the file picker; says whether it could. */
  pick: () => boolean;
}

/**
 * Images pasted, dropped or picked go up through the editor's upload, each
 * held in its place while it does. With no upload to take them, a paste or a
 * drop is left as it was.
 */
export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: 'imageUpload',
  addOptions() {
    return { files: () => false, pick: () => false };
  },
  addCommands() {
    return {
      pickImage: () => () => this.options.pick(),
    };
  },
  addProseMirrorPlugins() {
    const options = this.options;
    return [
      uploadPlaces(),
      new Plugin({
        key: new PluginKey('imageUploadInput'),
        props: {
          handlePaste: (_view, event) => {
            const images = imagesIn(event.clipboardData?.files);
            return images.length > 0 && options.files(images);
          },
          handleDrop: (view, event, _slice, moved) => {
            const images = moved ? [] : imagesIn(event.dataTransfer?.files);
            if (images.length === 0) {
              return false;
            }
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            return options.files(images, at);
          },
        },
      }),
    ];
  },
});

/** An image on its way up, or one that didn't make it. */
interface Upload {
  id: string;
  file: File;
  status: 'uploading' | 'failed';
  percent: number;
  error?: string;
  /** The element the card is drawn into: the widget's. */
  dom: HTMLElement;
}

/** A file's size, as people read one. */
export function sizeOf(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The card in an upload's place: its progress, or its failure with Retry and Remove. */
function UploadCard({
  upload,
  onRetry,
  onRemove,
}: {
  upload: Upload;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const name = upload.file.name;
  if (upload.status === 'uploading') {
    return (
      <div
        data-upload="uploading"
        className="rounded-8 border-gray-6 bg-surface-raised my-8 flex max-w-360 items-center gap-12 border-1 p-12 font-sans"
      >
        <Spinner size="lg" label="" className="text-gray-11" />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <span className="text-12 text-gray-12 truncate font-mono">{name}</span>
          <Progress
            value={upload.percent}
            size="sm"
            aria-label={`Uploading ${name}`}
            trailing={`${String(upload.percent)}%`}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      data-upload="failed"
      role="alert"
      className="rounded-8 border-red-7 bg-red-2 my-8 flex max-w-360 items-start gap-12 border-1 p-12 font-sans"
    >
      <Icon name="triangle-alert" size="lg" tone="danger" className="mt-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <span className="text-13 font-500 text-gray-12">
          Upload failed{upload.error ? `: ${upload.error}` : ''}
        </span>
        <span className="text-12 text-gray-11 truncate font-mono">
          {name} · {sizeOf(upload.file.size)}
        </span>
        <div className="mt-4 flex items-center gap-6">
          <Button size="sm" variant="outline" onClick={onRetry}>
            <Icon name="refresh" size="sm" />
            Retry
          </Button>
          <Button size="sm" variant="ghost" tone="neutral" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The editor's image uploads: what the `ImageUpload` extension calls (`files`,
 * `pick`), the hidden file input the picker is, and the cards, drawn into the
 * places the extension keeps. Each image goes up through `upload`; the image
 * node goes in only once it is there, where its place has moved to, and the
 * text around it is never touched. A failed one keeps its place, with Retry
 * and Remove.
 */
export function useImageUploads(
  editor: Editor | null,
  upload: { readonly current: UploadImage | undefined },
) {
  const [uploads, setUploads] = useState<ReadonlyMap<string, Upload>>(new Map());
  const input = useRef<HTMLInputElement>(null);
  const count = useRef(0);
  // What is going up now, read at once: a second Retry while one goes up does nothing.
  const sending = useRef(new Set<string>());
  // Each upload's file, for a retry.
  const filesOf = useRef(new Map<string, File>());
  // The editor the uploads land in: the one drawn last.
  const current = useRef(editor);
  useLayoutEffect(() => {
    current.current = editor;
  });

  const api = useMemo(() => {
    const live = () => {
      const view = current.current;
      return view !== null && !view.isDestroyed ? view : null;
    };
    const change = (id: string, next: (upload: Upload) => Upload | null) => {
      setUploads((all) => {
        const found = all.get(id);
        if (!found) {
          return all;
        }
        const copy = new Map(all);
        const changed = next(found);
        if (changed === null) {
          copy.delete(id);
        } else {
          copy.set(id, changed);
        }
        return copy;
      });
    };
    const send = (id: string, file: File) => {
      const put = upload.current;
      if (!put || sending.current.has(id)) {
        return;
      }
      sending.current.add(id);
      put(file, (percent) => {
        const rounded = Math.round(Math.min(100, Math.max(0, percent)));
        change(id, (found) => ({ ...found, percent: rounded }));
      })
        .then((src) => {
          sending.current.delete(id);
          filesOf.current.delete(id);
          const target = live();
          const at = target ? placeOf(target.state, id) : null;
          change(id, () => null);
          if (target === null || at === null) {
            return;
          }
          // Its place goes and the image comes in one step, leaving the focus
          // and the caret wherever they are now.
          target
            .chain()
            .command(({ tr }) => {
              tr.setMeta(placesKey, { remove: id } satisfies PlaceMeta);
              return true;
            })
            .insertContentAt(
              at,
              { type: 'image', attrs: { src, alt: file.name } },
              { updateSelection: false },
            )
            .run();
        })
        .catch((error: unknown) => {
          sending.current.delete(id);
          change(id, (found) => {
            return {
              ...found,
              status: 'failed',
              error: error instanceof Error && error.message ? error.message : undefined,
            };
          });
        });
    };
    const files = (images: File[], at?: number): boolean => {
      const target = live();
      if (!upload.current || target === null || images.length === 0) {
        return false;
      }
      const pos = at ?? target.state.selection.from;
      for (const file of images) {
        count.current += 1;
        const id = `upload-${String(count.current)}`;
        const dom = document.createElement('div');
        dom.contentEditable = 'false';
        dom.dataset['uploadPlace'] = id;
        target.view.dispatch(
          target.state.tr.setMeta(placesKey, { add: { id, pos, dom } } satisfies PlaceMeta),
        );
        filesOf.current.set(id, file);
        setUploads((all) => {
          return new Map(all).set(id, { id, file, status: 'uploading', percent: 0, dom });
        });
        send(id, file);
      }
      return true;
    };
    const retry = (id: string) => {
      const file = filesOf.current.get(id);
      if (file === undefined || sending.current.has(id)) {
        return;
      }
      change(id, (found) => ({ ...found, status: 'uploading', percent: 0, error: undefined }));
      send(id, file);
    };
    const remove = (id: string) => {
      filesOf.current.delete(id);
      const target = live();
      target?.view.dispatch(target.state.tr.setMeta(placesKey, { remove: id } satisfies PlaceMeta));
      change(id, () => null);
    };
    const pick = (): boolean => {
      if (!upload.current || input.current === null) {
        return false;
      }
      input.current.click();
      return true;
    };
    return { files, retry, remove, pick };
  }, [upload]);

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      hidden
      tabIndex={-1}
      aria-hidden
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        api.files(imagesIn(event.target.files));
        // The same file again is a new pick.
        event.target.value = '';
      }}
    />
  );

  const cards = [...uploads.values()].map((each) => {
    return createPortal(
      <UploadCard
        upload={each}
        onRetry={() => api.retry(each.id)}
        onRemove={() => api.remove(each.id)}
      />,
      each.dom,
      each.id,
    );
  });

  return { files: api.files, pick: api.pick, picker, cards };
}
