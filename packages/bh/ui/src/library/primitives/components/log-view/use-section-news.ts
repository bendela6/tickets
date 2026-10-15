import { useEffect, useRef, useState } from 'react';
import type { LogSectionState } from './utils/sections';

/** A section as the news reads it: what keeps its place, its title, how it is doing, and the section it is in. */
export interface SectionReport {
  key: string | number;
  title: string;
  state: LogSectionState;
  /** How long it took, once it is through: `31 s`. */
  took?: string;
  /** The key of the section it is in. */
  parent?: string | number;
}

/**
 * What a screen reader is told while a log streams: a section starting,
 * finishing or failing, never each line. It compares the sections with
 * those of the render before, so the first render says nothing, and a
 * section is told once of each: a section and the one it is in failing
 * together are told as the inner one alone.
 */
export function useSectionNews(sections: readonly SectionReport[]): string {
  const [news, setNews] = useState('');
  const before = useRef<ReadonlyMap<string | number, SectionReport> | undefined>(undefined);

  useEffect(() => {
    const was = before.current;
    const now = new Map(sections.map((section) => [section.key, section]));
    before.current = now;
    if (was === undefined) {
      return;
    }
    const failedNow = new Set(
      sections
        .filter((section) => section.state === 'failed' && was.get(section.key)?.state !== 'failed')
        .map((section) => section.key),
    );
    const said: string[] = [];
    for (const section of sections) {
      const then = was.get(section.key);
      if (then === undefined) {
        said.push(`Started: ${section.title}`);
      }
      if (failedNow.has(section.key)) {
        // Told by the section inside it that failed with it.
        const inner = sections.some(
          (other) => other.parent === section.key && failedNow.has(other.key),
        );
        if (!inner) {
          said.push(`Failed: ${section.title}`);
        }
      } else if (then?.state === 'running' && section.state === 'done') {
        said.push(`Finished: ${section.title}${section.took ? `, in ${section.took}` : ''}`);
      }
    }
    if (said.length > 0) {
      setNews(`${said.join('. ')}.`);
    }
  }, [sections]);

  return news;
}
