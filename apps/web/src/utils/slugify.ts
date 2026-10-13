// A name as a key: lower case, each run of anything but a-z and 0-9 one
// separator, none at either end ("In review" is `in-review`). An option's
// value, a type's and a link type's key take `-`; a field's key takes `_`.
export function slugify(name: string, separator: '-' | '_' = '-'): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');
}
