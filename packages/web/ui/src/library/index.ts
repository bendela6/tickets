// Every form control — and the three shared pieces only they use — lives in
// ./inputs now. One re-export rather than fourteen: the group has a boundary,
// and the barrel should say so rather than listing its members as peers of
// Avatar and Toast.
export * from './inputs';

export * from './feedback';
export * from './field-error';
export * from './field-label';
export * from './layout';
export * from './navigation';
export * from './overlays';
export * from './primitives';

export * from './forms';
export * from './table';
