import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// --- Toast state (module-level so toast() works outside React) ---

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type Action = { type: 'ADD'; toast: ToastItem } | { type: 'REMOVE'; id: string };

const listeners: Array<(toasts: ToastItem[]) => void> = [];
let state: ToastItem[] = [];

function dispatch(action: Action) {
  state = action.type === 'ADD'
    ? [...state, action.toast]
    : state.filter((t) => t.id !== action.id);
  listeners.forEach((l) => l(state));
}

// Call toast() anywhere in the app
export function toast(options: Omit<ToastItem, 'id'>) {
  const id = Math.random().toString(36).slice(2, 9);
  const duration = options.duration ?? 4000;
  dispatch({ type: 'ADD', toast: { id, duration, ...options } });
  setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
  return id;
}

function useToastState() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(state);
  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const i = listeners.indexOf(setToasts);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return toasts;
}

// --- Toaster component ---

export const Toaster = () => {
  const toasts = useToastState();

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {toasts.map(({ id, title, description, variant }) => (
        <ToastPrimitives.Root
          key={id}
          onOpenChange={(open) => { if (!open) dispatch({ type: 'REMOVE', id }); }}
          className={cn(
            'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
            'data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
            variant === 'success' && 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
            variant === 'error'   && 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
            variant === 'warning' && 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100',
            (!variant || variant === 'default') && 'border bg-background text-foreground',
          )}
        >
          <div className="flex-1 grid gap-0.5">
            {title && (
              <ToastPrimitives.Title className="text-sm font-semibold leading-snug">
                {title}
              </ToastPrimitives.Title>
            )}
            {description && (
              <ToastPrimitives.Description className="text-sm opacity-80 leading-snug">
                {description}
              </ToastPrimitives.Description>
            )}
          </div>
          <ToastPrimitives.Close
            className="absolute right-2 top-2 rounded-md p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </ToastPrimitives.Close>
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm" />
    </ToastPrimitives.Provider>
  );
};
