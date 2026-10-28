// The commands the toolbar and the link popover chain (toggleBold, setLink,
// setDetails, setColor …) are typed by each Tiptap extension's augmentation of
// @tiptap/core. @tilewise/richtext installs those extensions, but its published
// types don't import them, so the editor loads their types here.
import type {} from '@tiptap/extension-details';
import type {} from '@tiptap/extension-highlight';
import type {} from '@tiptap/extension-task-list';
import type {} from '@tiptap/extension-text-style';
import type {} from '@tiptap/starter-kit';
