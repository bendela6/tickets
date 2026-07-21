// Runs before any test file loads, so environment.ts (which reads
// process.env at module load) always targets signals_test regardless of
// how the test command was invoked.
process.env.SIGNALS_DATABASE = 'signals_test';
