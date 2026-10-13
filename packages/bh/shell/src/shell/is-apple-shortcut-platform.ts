// Which modifier the search shortcut uses, decided once for both the hint and
// the key handler so the label can never disagree with what actually fires.

/** True on Apple platforms, where the search shortcut is ⌘K rather than Ctrl K. */
export function isAppleShortcutPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
