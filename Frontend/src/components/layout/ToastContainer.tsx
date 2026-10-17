import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/store';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ToastContainer: React.FC = () => {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border max-w-xs',
              'bg-white border-zinc-200',
            )}
          >
            {toast.variant === 'success' && <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />}
            {toast.variant === 'error' && <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />}
            {(!toast.variant || toast.variant === 'default') && <Info size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900">{toast.title}</p>
              {toast.description && <p className="text-xs text-zinc-500 mt-0.5">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
