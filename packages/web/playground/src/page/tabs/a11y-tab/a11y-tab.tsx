import { useEffect, useRef, useState } from 'react';
import type { AxeResults } from 'axe-core';
import { cn } from '@tickets/ui';

interface AuditState {
  results: AxeResults | null;
  timestamp: number | null;
  isLoading: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function getImpactClasses(impact: string | null | undefined): string {
  if (impact === 'critical' || impact === 'serious') {
    return 'bg-red-3 text-red-9';
  }
  if (impact === 'moderate' || impact === 'minor') {
    return 'bg-orange-3 text-orange-9';
  }
  return 'bg-gray-7 text-gray-11';
}

export function A11yTab({ runAudit: runAuditImpl }: { runAudit: () => Promise<AxeResults> }) {
  const [auditState, setAuditState] = useState<AuditState>({
    results: null,
    timestamp: null,
    isLoading: false,
  });
  const timeUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update relative time display every minute
  useEffect(() => {
    if (auditState.timestamp === null) return;

    // Force update to refresh relative time
    const interval = setInterval(() => {
      setAuditState((prev) => (prev.timestamp ? { ...prev } : prev));
    }, 60000); // Update every minute

    timeUpdateIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [auditState.timestamp]);

  const runAudit = async () => {
    setAuditState((prev) => ({ ...prev, isLoading: true }));

    try {
      const results = await runAuditImpl();
      setAuditState({
        results,
        timestamp: Date.now(),
        isLoading: false,
      });
    } catch (error) {
      console.error('A11y audit failed:', error);
      setAuditState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const metaText = auditState.timestamp
    ? `last audit · ${formatRelativeTime(auditState.timestamp)} · axe-core ${auditState.results?.testEngine.version || 'unknown'}`
    : 'no audit yet';

  const hasViolations =
    auditState.results && auditState.results.violations && auditState.results.violations.length > 0;
  const elementCount = auditState.results
    ? auditState.results.passes.reduce((acc, pass) => acc + pass.nodes.length, 0)
    : 0;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header with meta and button */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-meta text-gray-9">{metaText}</span>
        <button
          type="button"
          onClick={runAudit}
          disabled={auditState.isLoading}
          className="h-7 rounded-lg border border-gray-7 bg-surface-raised px-3 font-sans text-meta text-gray-12 hover:bg-surface-inset disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {auditState.isLoading ? 'auditing…' : 'Run audit'}
        </button>
      </div>

      {/* Results */}
      {auditState.results && (
        <div className="flex flex-col gap-2.5">
          {hasViolations ? (
            // Violations cards
            auditState.results.violations.map((violation) => (
              <div
                key={violation.id}
                className="rounded-lg border border-gray-6 bg-surface-raised p-3.5 flex flex-col gap-2"
              >
                {/* Impact chip + Rule ID */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-5 px-2 rounded-md font-mono text-label inline-flex items-center',
                      getImpactClasses(violation.impact),
                    )}
                  >
                    {violation.impact}
                  </span>
                  <span className="font-sans text-ui font-500 text-gray-12">{violation.id}</span>
                </div>

                {/* Description */}
                <p className="font-sans text-meta text-gray-11">{violation.description}</p>

                {/* Target selector and Learn more link */}
                <div className="flex items-center justify-between gap-2.5">
                  <code className="font-mono text-label text-gray-11 bg-surface-inset rounded-md px-1.75 py-0.5 overflow-x-auto text-nowrap">
                    {String(violation.nodes[0]?.target?.[0]) || '(selector)'}
                  </code>
                  <a
                    href={violation.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-sans text-label font-500 text-indigo-9 hover:underline"
                  >
                    Learn more ↗
                  </a>
                </div>
              </div>
            ))
          ) : (
            // All clear banner
            <div className="flex items-center gap-2.5 rounded-lg bg-green-3 p-3.5">
              <span className="flex-none size-4 rounded-full bg-green-9 text-gray-1 flex items-center justify-center font-sans text-nano font-600">
                ✓
              </span>
              <span className="font-sans text-ui font-500 text-green-9">
                No violations found
              </span>
              <span className="font-mono text-label text-green-9 opacity-75">
                · {elementCount} elements checked
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
