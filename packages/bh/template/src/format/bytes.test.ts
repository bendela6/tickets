import { describe, expect, it } from 'vitest';
import { formatBytes } from './bytes';

const KiB = 1024;
const MiB = 1024 ** 2;
const GiB = 1024 ** 3;

describe('formatBytes', () => {
  it('writes the largest unit that keeps the number at one or more', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(64 * MiB)).toBe('64 MiB');
    expect(formatBytes(2_252_000_000)).toBe('2.1 GiB');
  });

  it('counts in 1024s with IEC names unless told otherwise', () => {
    expect(formatBytes(KiB)).toBe('1 KiB');
    expect(formatBytes(1000)).toBe('1000 B');
  });

  it('counts in 1000s with SI names when decimal', () => {
    expect(formatBytes(1000, { units: 'decimal' })).toBe('1 kB');
    expect(formatBytes(1536, { units: 'decimal' })).toBe('1.5 kB');
    expect(formatBytes(64 * MiB, { units: 'decimal' })).toBe('67.1 MB');
    expect(formatBytes(2_252_000_000, { units: 'decimal' })).toBe('2.3 GB');
  });

  it('writes whole bytes under one unit, since a byte does not split', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(512.6)).toBe('513 B');
  });

  it('drops the zeros of a whole amount', () => {
    expect(formatBytes(5 * MiB)).toBe('5 MiB');
    expect(formatBytes(8 * GiB)).toBe('8 GiB');
  });

  it('moves up a unit when the rounding reaches it, never writing 1024 KiB', () => {
    expect(formatBytes(1_048_570)).toBe('1 MiB');
    expect(formatBytes(1023.6)).toBe('1 KiB');
    expect(formatBytes(999_960, { units: 'decimal' })).toBe('1 MB');
  });

  it('takes the digits after the point', () => {
    expect(formatBytes(1500, { digits: 2 })).toBe('1.46 KiB');
    expect(formatBytes(1536, { digits: 0 })).toBe('2 KiB');
    expect(formatBytes(1_048_000, { digits: 0 })).toBe('1023 KiB');
    expect(formatBytes(1_048_100, { digits: 0 })).toBe('1 MiB');
    expect(formatBytes(512, { digits: 2 })).toBe('512 B');
  });

  it('reads digits it cannot use as the nearest it can', () => {
    expect(formatBytes(1500, { digits: -1 })).toBe('1 KiB');
    expect(formatBytes(1500, { digits: 2.7 })).toBe('1.46 KiB');
    expect(formatBytes(1500, { digits: Number.NaN })).toBe('1 KiB');
  });

  it('goes up to an exabyte, and writes anything larger in exabytes', () => {
    expect(formatBytes(5 * 1024 ** 5)).toBe('5 PiB');
    expect(formatBytes(1024 ** 6)).toBe('1 EiB');
    expect(formatBytes(2048 * 1024 ** 6)).toBe('2048 EiB');
    expect(formatBytes(3 * 1000 ** 6, { units: 'decimal' })).toBe('3 EB');
  });

  it('keeps the sign of a change in size', () => {
    expect(formatBytes(-1536)).toBe('-1.5 KiB');
    expect(formatBytes(-512)).toBe('-512 B');
    expect(formatBytes(-0.2)).toBe('0 B');
  });

  it('hands back a number that is not finite as String writes it', () => {
    expect(formatBytes(Number.NaN)).toBe('NaN');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  it('reads units it does not know as binary', () => {
    // A format's options can come from data, where the type does not reach.
    expect(formatBytes(1536, { units: 'metric' as 'decimal' })).toBe('1.5 KiB');
  });
});
