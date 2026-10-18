import * as v from 'valibot';

/** A gap, in steps of 4px: 0, 4, 8, 12, 16, 24, 32. */
export const gap = v.picklist([0, 1, 2, 3, 4, 6, 8]);

/** A whole number, 1 or more. */
export const count = v.pipe(v.number(), v.integer(), v.minValue(1));
