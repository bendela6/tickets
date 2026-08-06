// The seven this package has always exported by name. The other eighteen
// adapters reach consumers the way all twenty-five actually get used: through
// `baseInputs`, which apps/web spreads and extends with its own `directory`
// kind. Nothing anywhere imports a *Field by name from @tickets/ui — verified
// across all 177 import sites — so widening this barrel would add symbols with
// no caller, and narrowing it would remove symbols with no caller. Either is a
// deliberate change to make on its own, not inside a 340-file move.
export * from './text/text-field';
export * from './textarea/textarea-field';
export * from './number/number-field';
export * from './select/select-field';
export * from './multi-select/multi-select-field';
export * from './toggle/toggle-field';
export * from './json/json-field';
