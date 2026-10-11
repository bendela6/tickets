/** What a folded line reads in place of the members it is hiding. */
export function containerSummary(type: 'object' | 'array', size: number): string {
  const noun = type === 'array' ? 'item' : 'key';
  return `${size} ${noun}${size === 1 ? '' : 's'}`;
}
