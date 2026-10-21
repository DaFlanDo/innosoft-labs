import { useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  withInput?: boolean;
}

/**
 * Programmatic confirm/prompt dialog — replacement for window.confirm/window.prompt
 * Usage: const result = await confirm({ title: '...', withInput: true })
 * Returns: string if confirmed with input, true if confirmed, null if cancelled
 */
export function useConfirm() {
  return useCallback(
    (options: ConfirmOptions): Promise<string | boolean | null> => {
      return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        const cleanup = () => {
          root.unmount();
          container.remove();
        };

        const handleConfirm = (inputValue?: string) => {
          cleanup();
          resolve(options.withInput ? (inputValue ?? '') : true);
        };

        const handleCancel = () => {
          cleanup();
          resolve(null);
        };

        root.render(
          <ConfirmDialog
            isOpen
            title={options.title}
            message={options.message}
            placeholder={options.placeholder}
            confirmLabel={options.confirmLabel}
            cancelLabel={options.cancelLabel}
            variant={options.variant ?? 'danger'}
            withInput={options.withInput ?? false}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        );
      });
    },
    []
  );
}
