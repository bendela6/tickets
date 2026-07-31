/**
 * The one screen.
 *
 * Layout is fixed by the design: a 48px top bar, then three columns — a 232px
 * object rail, the canvas field, and a 264px properties rail. The rails sit on
 * the app background with no fill and no card; the only thing separating them
 * from the canvas is a hairline and the fact that the canvas field is
 * *recessed* rather than raised. The artboard inside it is the single bright
 * surface on screen.
 */
export function App() {
  return (
    <div className="flex h-screen flex-col bg-gray-1 font-sans text-gray-12">
      <header className="flex h-12 flex-none items-center gap-2.75 border-b-1 border-gray-6 pl-4 pr-3.25">
        <span aria-hidden className="size-2.5 flex-none rounded-sm bg-indigo-9" />
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-58 flex-none flex-col border-r-1 border-gray-6" />

        <main className="relative flex min-w-0 flex-1 items-center justify-center bg-surface-field" />

        <div className="w-66 flex-none overflow-auto border-l-1 border-gray-6" />
      </div>
    </div>
  );
}
