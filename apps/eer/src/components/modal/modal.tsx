// Generic accessible dialog — no diagram/editor knowledge, so it's reusable and
// testable standalone. A fixed overlay backdrop centers a bordered panel; Esc
// and a backdrop click both close, a click inside the panel does not (the
// panel's own onClick stops the event before it bubbles to the backdrop).

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

import { cn } from '../../ui/cn';

export interface ModalProps {
  title: string;
  onClose: () => void;
  // 'wide' fits a form that would otherwise scroll sideways (the field grid).
  size?: 'default' | 'wide';
  children: ReactNode;
}

export function Modal({ title, onClose, size = 'default', children }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const stopInside = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', 'bg-gray-950/60 p-4')} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'flex max-h-full w-full flex-col gap-3 overflow-auto',
          'rounded-lg border border-gray-500 bg-gray-800 px-4 py-4 shadow-xl',
          { 'max-w-md': size === 'default', 'max-w-5xl': size === 'wide' },
        )}
        onClick={stopInside}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-medium text-gray-50">
            {title}
          </h2>
          <button type="button" className="text-lg text-gray-200 hover:text-gray-50" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
