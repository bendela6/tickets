import { Button, DialogContent, DialogRoot, DialogTitle } from '@tickets/ui';
import type { ImportSummary } from './map';

/**
 * What an import gave up, shown once, straight after it happened.
 *
 * The report is the other half of the result rather than a log: this importer
 * drops whatever the document model has no term for, and a drop nobody is told
 * about is indistinguishable from a bug. It follows the export dialog's chrome
 * — a titled header, a body, a single closing action — because it is the same
 * kind of moment at the other end of the same trip.
 */
export function ImportReportDialog({
  summary,
  onClose,
}: {
  summary: ImportSummary;
  onClose: () => void;
}) {
  const notes = summary.ok ? summary.report.notes : [];

  /**
   * A file read whole that held nothing this model can draw is not the same
   * event as a count of zero: without saying so, an empty document looks like
   * the import quietly failed. Every reason it was empty is in the list below.
   */
  const emptied = summary.ok && summary.report.objects === 0;

  return (
    <DialogRoot open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-140 max-w-full p-0">
        <div className="flex items-start gap-3 border-b-1 border-gray-6 px-5 pb-3.5 pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.75">
            <DialogTitle className="font-sans text-16 font-600 text-gray-12">
              {summary.ok ? `Imported ${summary.file}` : `Could not import ${summary.file}`}
            </DialogTitle>
            <span className="font-sans text-12 text-gray-11">
              {!summary.ok
                ? summary.message
                : emptied
                  ? 'The file was read whole, and nothing in it could become an object — the new document is empty. Every reason is below.'
                  : `${summary.report.objects} ${summary.report.objects === 1 ? 'object' : 'objects'} into a new document. An import never merges into the one you were editing.`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-5 pb-4 pt-3.5">
          {summary.ok && notes.length === 0 ? (
            <span className="font-mono text-11 text-gray-9">
              nothing was dropped — the whole file is in the document
            </span>
          ) : null}

          {notes.length > 0 ? (
            <ul
              aria-label="What the import gave up"
              className="flex max-h-80 flex-col gap-0.5 overflow-auto"
            >
              {notes.map((note) => (
                <li
                  key={`${note.element} ${note.reason}`}
                  className="flex items-start gap-2.5 bg-surface-inset px-3.25 py-2"
                >
                  <span className="w-24 flex-none font-mono text-11 text-gray-12">
                    {note.element}
                  </span>
                  <span className="min-w-0 flex-1 font-sans text-11/relaxed text-gray-11 text-pretty">
                    {note.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-center gap-2.25 border-t-1 border-gray-6 bg-gray-1 px-5 py-3.25">
          <span className="flex-1 font-mono text-11 text-gray-9">
            {summary.ok
              ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
              : 'nothing was opened'}
          </span>
          <Button variant="solid" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
