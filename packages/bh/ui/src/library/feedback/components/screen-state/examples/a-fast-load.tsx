import { useEffect, useState } from 'react';
import { Button, Card, ScreenState } from '@bh/ui';

export function AFastLoad() {
  // How long the load being shown takes, in milliseconds; null once it has answered.
  const [loading, setLoading] = useState<number | null>(null);
  useEffect(() => {
    if (loading === null) {
      return undefined;
    }
    // Stands in for the request.
    const timer = setTimeout(() => setLoading(null), loading);
    return () => clearTimeout(timer);
  }, [loading]);
  return (
    <div className="flex w-320 flex-col gap-12">
      <div className="flex gap-8">
        <Button size="sm" onClick={() => setLoading(200)}>
          Load in 0.2 s
        </Button>
        <Button size="sm" onClick={() => setLoading(2000)}>
          Load in 2 s
        </Button>
      </div>
      <Card>
        {loading === null ? (
          <ScreenState icon="search" title="No files yet" />
        ) : (
          <ScreenState state="loading" title="Loading the files…" />
        )}
      </Card>
    </div>
  );
}
