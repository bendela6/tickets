---
title: formatBytes
summary: 'Writes a size in bytes as a person reads it, 1.5 KiB or 1.5 kB: in
  binary units or in decimal ones.'
related: [FileInput, Figures, formatDuration]
---

[//]: # 'written from format-bytes.doc.yaml by pnpm docs:sync; edit that file, not this one'

# formatBytes

Writes a size in bytes as a person reads it: in the largest unit that
keeps the number at one or more, to one decimal. `1536` is `1.5 KiB`,
and `67108864` is `64 MiB`.

## Import

```tsx
import { formatBytes } from '@bh/ui';
```

## Examples

Binary units count 1024 bytes to the next, and are written as IEC writes
them: `KiB`, `MiB`, `GiB`. They are the default, since a memory size or a
limit set in powers of two counts in them. `units: 'decimal'` counts
1000 instead, as a disk's label and macOS count, and writes the units as
SI does: `kB`, `MB`, `GB`. Each step keeps its own names, so a reader
never has to guess whether a `KB` means 1000 bytes or 1024.

**The same sizes, both ways**

```tsx
import { Figure, Figures, formatBytes } from '@bh/ui';

const SIZES = [512, 1_536, 248_000, 67_108_864, 2_252_000_000];

export function BinaryOrDecimal() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Binary">
        {SIZES.map((bytes) => {
          return (
            <Figure key={bytes} label={bytes.toLocaleString('en-US')} value={formatBytes(bytes)} />
          );
        })}
      </Figures>
      <Figures title="Decimal">
        {SIZES.map((bytes) => {
          return (
            <Figure
              key={bytes}
              label={bytes.toLocaleString('en-US')}
              value={formatBytes(bytes, { units: 'decimal' })}
            />
          );
        })}
      </Figures>
    </div>
  );
}
```

Under one unit a size is whole bytes, `512 B`. Above it, `digits` sets
the most digits after the point, 1 unless given, and a whole amount
drops its zeros: `64 MiB`, not `64.0 MiB`.

```ts
formatBytes(bytes: number, options?: FormatBytesOptions): string
```

A size in bytes in the largest unit that keeps it at one or more, to one
decimal: `1536` is `1.5 KiB`, `67108864` is `64 MiB`. Under one unit it is
whole bytes, `512 B`, since a byte does not split.

A size that rounds up to the next unit is written in it: `1048570` is
`1 MiB`, never `1024 KiB`. A negative size keeps its sign, for a change in
size; a number that is not finite comes back as `String` writes it.

| Parameter          | Type                                             | Default    | Description                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bytes` (required) | `number`                                         |            | The size, in bytes.                                                                                                                                                                                                          |
| `options`          | `FormatBytesOptions`                             | `{}`       | Binary or decimal units, and how many digits after the point.                                                                                                                                                                |
| `options.units`    | `'binary' \| 'decimal'`: `'binary'`, `'decimal'` | `'binary'` | How many bytes make the next unit, and the names the units take: `binary`, 1024, written `KiB`, `MiB`, `GiB` as IEC writes them; or `decimal`, 1000, written `kB`, `MB`, `GB` as SI does, as a disk's label and macOS count. |
| `options.digits`   | `number`                                         | `1`        | The most digits after the point, past whole bytes: `1.46 KiB` with 2, `1 KiB` with 0. A whole amount drops its zeros, so `64 MiB`, not `64.0 MiB`.                                                                           |

Returns `string`.
