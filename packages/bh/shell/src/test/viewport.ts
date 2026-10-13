// The viewport the tests' matchMedia reports. Wide by default; a test that
// wants the phone layout says so before it renders, and setup.ts resets it.

let narrow = false;

/** Make the next render see a phone-width viewport (or a wide one again). */
export function setNarrowViewport(next: boolean): void {
  narrow = next;
}

/** What the fake matchMedia answers for a max-width query. */
export function isNarrowViewport(): boolean {
  return narrow;
}
