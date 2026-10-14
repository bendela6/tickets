import { LogView, type LogLine, type LogRule } from '@bh/ui';

// The app's own highlights, on top of the defaults. A module constant, so the
// lines are read once.
const RULES: readonly LogRule[] = [
  { match: /\breqId=\S+/, tone: 'quiet' },
  { match: /\b[45]\d\d\b(?= in)/, tone: 'warning' },
  { match: /\b2\d\d\b(?= in)/, tone: 'success' },
];

const at = Date.UTC(2026, 9, 8, 21, 46, 25);

// Lines with times: the time shows beside a line only where it changes.
const LINES: LogLine[] = [
  { time: at, text: 'INFO incoming request GET / reqId=req-20x' },
  { time: at + 120, text: 'INFO request completed 404 in 0.2 ms reqId=req-20x' },
  { time: at + 6000, text: 'INFO incoming request GET /api/health reqId=req-20y' },
  { time: at + 6004, text: 'INFO request completed 200 in 4.9 ms reqId=req-20y' },
];

export function RulesAndTimes() {
  return <LogView lines={LINES} rules={RULES} label="Service log" className="w-full" />;
}
