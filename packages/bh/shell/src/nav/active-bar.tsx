// The 3px indigo marker on the sidebar's left edge. One definition so the rail
// and the expanded rows can never drift to different widths.

/** The active row's edge indicator, positioned against a `relative` row. */
export function ActiveBar() {
  return <span aria-hidden className="bg-indigo-9 absolute inset-y-0 left-0 w-3" />;
}
