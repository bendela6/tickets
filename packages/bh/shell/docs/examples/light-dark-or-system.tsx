import { ThemeChoice, useTheme } from '@bh/shell';
import { Card } from '@bh/ui';

// The app's own key: two apps on one origin must not share it.
const THEME_STORAGE_KEY = 'garden-theme';

export function LightDarkOrSystem() {
  const { preference, theme, setPreference } = useTheme(THEME_STORAGE_KEY);
  return (
    <div className="bg-gray-1 p-16">
      <Card padding={4} className="flex max-w-320 flex-col gap-12">
        <ThemeChoice preference={preference} onChange={setPreference} />
        <p className="text-13/19 text-gray-11">
          Picked: <span className="text-gray-12 font-mono">{preference}</span>. Painted:{' '}
          <span className="text-gray-12 font-mono">{theme}</span>.
        </p>
      </Card>
    </div>
  );
}
