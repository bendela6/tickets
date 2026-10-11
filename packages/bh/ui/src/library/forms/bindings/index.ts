// The seven this package has always exported by name. The other eighteen
// adapters reach consumers the way all twenty-five actually get used: through
// `baseInputs`, which an app spreads and extends with kinds of its own.
// Nothing imports a *Field by name from @bh/ui, so widening this barrel would
// add symbols with no caller, and narrowing it would remove symbols with no
// caller. Either is a deliberate change to make on its own.
export * from './text/text-field';
export * from './textarea/textarea-field';
export * from './number/number-field';
export * from './select/select-field';
export * from './multi-select/multi-select-field';
export * from './toggle/toggle-field';
export * from './json/json-field';
