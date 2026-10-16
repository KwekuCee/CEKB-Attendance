import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'checkin' | 'announcement';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
  timestamp?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showCheckIn: (memberName: string, serviceType?: string) => void;
  showAnnouncement: (title: string, message?: string, audience?: string) => void;
  removeToast: (id: string) => void;
}

const defaultToastContext: ToastContextValue = {
  showToast: () => {},
  showSuccess: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
  showCheckIn: () => {},
  showAnnouncement: () => {},
  removeToast: () => {},
};

const ToastContext = createContext<ToastContextValue>(defaultToastContext);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newToast: ToastItem = {
        id,
        type,
        title,
        message: message == null ? undefined : typeof message === "string" ? message : String((message as any)?.message ?? ""),
        duration,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setToasts(prev => [newToast, ...prev].slice(0, 5)); // Keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast('success', title, message, 4000);
  }, [showToast]);

  const showError = useCallback((title: string, message?: string) => {
    showToast('error', title, message, 6000);
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message, 5000);
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    showToast('info', title, message, 4000);
  }, [showToast]);

  const showCheckIn = useCallback((memberName: string, serviceType = 'Sunday Service') => {
    showToast('checkin', `Check-In Confirmed!`, `${memberName} successfully checked into ${serviceType}.`, 5000);
  }, [showToast]);

  const showAnnouncement = useCallback((title: string, message?: string, _audience?: string) => {
    showToast('announcement', `📢 ${title}`, message, 7000);
  }, [showToast]);

  const getToastStyle = (type: ToastType) => {
    switch (type) {
      case 'checkin':
        return {
          bg: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100',
          icon: 'how_to_reg',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          accent: 'border-l-4 border-l-emerald-400',
        };
      case 'success':
        return {
          bg: 'bg-slate-900/95 border-slate-700 text-slate-100',
          icon: 'check_circle',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          accent: 'border-l-4 border-l-emerald-400',
        };
      case 'error':
        return {
          bg: 'bg-rose-950/95 border-rose-800 text-rose-100',
          icon: 'error',
          iconBg: 'bg-rose-500/20 text-rose-400',
          accent: 'border-l-4 border-l-rose-500',
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/95 border-amber-800 text-amber-100',
          icon: 'warning',
          iconBg: 'bg-amber-500/20 text-amber-400',
          accent: 'border-l-4 border-l-amber-400',
        };
      case 'announcement':
        return {
          bg: 'bg-indigo-950/95 border-indigo-700 text-indigo-100',
          icon: 'campaign',
          iconBg: 'bg-indigo-500/20 text-indigo-400',
          accent: 'border-l-4 border-l-indigo-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-900/95 border-slate-700 text-slate-100',
          icon: 'info',
          iconBg: 'bg-blue-500/20 text-blue-400',
          accent: 'border-l-4 border-l-blue-400',
        };
    }
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showCheckIn,
        showAnnouncement,
        removeToast,
      }}
    >
      {children}

      {/* Global Animated Toast Container */}
      <div
        id="toast-notifications-container"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => {
            const style = getToastStyle(toast.type);
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-xl ${style.bg} ${style.accent}`}
              >
                <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${style.iconBg}`}>
                  <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-headline font-bold text-sm leading-snug tracking-tight text-white">
                      {toast.title}
                    </h4>
                    {toast.timestamp && (
                      <span className="font-mono text-[10px] text-slate-400 opacity-75 shrink-0">
                        {toast.timestamp}
                      </span>
                    )}
                  </div>
                  {toast.message && (
                    <p className="text-xs text-slate-300 font-body mt-1 leading-relaxed break-words">
                      {toast.message}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  title="Close notification"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  try {
    const context = useContext(ToastContext);
    return context || defaultToastContext;
  } catch (err) {
    return defaultToastContext;
  }
};
