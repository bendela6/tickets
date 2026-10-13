// Drawer and SidePanel are the only callers. Exported anyway — an app that
// builds its own resizable panel needs the same width and persistence hooks,
// and useIsNarrow is what an app's own frame reads (as @bh/shell does).
export * from './panel';
// Dialog, Drawer and SidePanel give focus back with it, and so can an app's
// own surface.
export * from './restore-focus';
