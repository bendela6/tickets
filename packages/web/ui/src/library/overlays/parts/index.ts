// Drawer and SidePanel are the only callers. Exported anyway — an app that
// builds its own resizable panel needs the same width and persistence hooks,
// and useIsNarrow is already used directly by apps/web's shell.
export * from './panel';
