import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ShoppingCart, X } from 'lucide-react';

export interface ToastData {
  id: number;
  title: string;
  subtitle: string;
}

interface ToastNotificationProps {
  toast: ToastData | null;
  onOpenBasket: () => void;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  onOpenBasket,
  onDismiss,
}) => {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 pointer-events-none max-w-sm w-[calc(100vw-2.5rem)]"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto bg-[#0A0A0A] text-white border border-white/20 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white text-[#0A0A0A] flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {toast.title}
                </p>
                <p className="text-xs text-white/75 truncate">{toast.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onDismiss();
                  onOpenBasket();
                }}
                className="px-3.5 py-1.5 rounded-full bg-white text-[#0A0A0A] hover:bg-[#E5E5E5] transition-colors text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1"
              >
                <ShoppingCart className="w-3 h-3" aria-hidden="true" />
                <span>Cart</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="p-1.5 rounded-full text-white/60 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
