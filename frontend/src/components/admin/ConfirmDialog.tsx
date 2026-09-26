import { ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  tone?: 'danger' | 'default';
  /** Optional extra action between cancel and confirm (e.g. "Hide instead"). */
  extra?: ReactNode;
}

/** In-page confirmation (replaces window.confirm). Bottom sheet on phones, centred card on larger screens. */
const ConfirmDialog = ({
  open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, busy, tone = 'danger', extra,
}: ConfirmDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} />
      <div className="relative w-full sm:max-w-md surface rounded-b-none sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="flex gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            tone === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-primary/10 text-primary',
          )}>
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-semibold leading-snug">{title}</h2>
            {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="btn btn-outline btn-sm">
            {cancelLabel}
          </button>
          {extra}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn('btn btn-sm', tone === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-primary')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
