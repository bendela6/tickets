import * as v from 'valibot';

/** A number above 0. */
export const positive = v.pipe(v.number(), v.finite(), v.gtValue(0));

/** An Avatar size: `xs` to `xl`. */
export const avatarSize = v.picklist(['xs', 'sm', 'md', 'lg', 'xl']);
