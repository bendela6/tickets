import type { ITheme } from '@xterm/xterm';

// The ANSI-16 Instrument palette from screen 10 (docs/design/10-ai-sessions.html
// term_L / term_D). Passed explicitly to the xterm constructor so the terminal
// is themed from Instrument tokens rather than shipping xterm's default palette,
// and so it tracks the app's light/dark switch.
export const terminalThemeLight: ITheme = {
  background: '#FBFAF7',
  foreground: '#33312A',
  selectionBackground: '#E9E7FA',
  cursor: '#4E46C6',
  cursorAccent: '#FBFAF7',
  black: '#33312A',
  red: '#C0382E',
  green: '#2E7D4F',
  yellow: '#8A6A10',
  blue: '#2E6FCC',
  magenta: '#7B3FA0',
  cyan: '#14687E',
  white: '#B9B5AA',
  brightBlack: '#918D80',
  brightRed: '#E05A4F',
  brightGreen: '#3F9E68',
  brightYellow: '#C29A2E',
  brightBlue: '#5A92E0',
  brightMagenta: '#A063C8',
  brightCyan: '#2E93AC',
  brightWhite: '#F7F6F2',
};

export const terminalThemeDark: ITheme = {
  background: '#12110E',
  foreground: '#D9D6CA',
  selectionBackground: '#2C2A4A',
  cursor: '#918AEC',
  cursorAccent: '#12110E',
  black: '#343128',
  red: '#E26A5F',
  green: '#57B383',
  yellow: '#DFC060',
  blue: '#6BA4EE',
  magenta: '#C591E8',
  cyan: '#74C4DC',
  white: '#A6A296',
  brightBlack: '#79756A',
  brightRed: '#F0968D',
  brightGreen: '#7FCB97',
  brightYellow: '#EAD388',
  brightBlue: '#8BB4EF',
  brightMagenta: '#D8B3F0',
  brightCyan: '#9BD7E8',
  brightWhite: '#EDEBE3',
};

export type ThemeName = 'light' | 'dark';

export function terminalTheme(name: ThemeName): ITheme {
  return name === 'dark' ? terminalThemeDark : terminalThemeLight;
}

// The app stamps the active theme on <html data-theme>; default to light.
export function currentThemeName(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
