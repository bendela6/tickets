// The package's single entry point — `@bh/ui` resolves here and nothing
// else does, apart from the tokens.css stylesheet.
//
// `tokens/` is not re-exported: the generators read the JSON by path and write
// the tables in `style/generated/`, which the barrel does export. Pulling
// ~2500 lines of JSON through it would be pure cost.
import './style/css-custom-properties';

export * from './style';
export * from './library';
