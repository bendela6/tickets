import { LogView } from '@bh/ui';

const ESC = '\u001b';

// Lines as a test runner prints them to a terminal, escape codes and all.
const RUN = [
  `${ESC}[1m${ESC}[46m RUN ${ESC}[49m${ESC}[22m ${ESC}[36mv5.0.1${ESC}[39m ${ESC}[90m/repo/packages/ui${ESC}[39m`,
  `${ESC}[32m✓${ESC}[39m src/parse.test.ts ${ESC}[2m(17 tests)${ESC}[22m ${ESC}[33m13ms${ESC}[39m`,
  `${ESC}[31m×${ESC}[39m src/fold.test.ts ${ESC}[2m(4 tests | 1 failed)${ESC}[22m`,
  `${ESC}[35mmagenta${ESC}[39m ${ESC}[34mblue${ESC}[39m ${ESC}[4munderlined${ESC}[24m ${ESC}[38;5;208m256-colour orange${ESC}[39m ${ESC}[38;2;30;160;60m24-bit green${ESC}[39m`,
  `${ESC}[2K${ESC}[1A${ESC}[2K${ESC}[G Test Files  ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m | ${ESC}[1m${ESC}[32m2 passed${ESC}[39m${ESC}[22m (3)`,
];

export function AnsiColors() {
  return <LogView lines={RUN} label="Test run" className="w-full" />;
}
