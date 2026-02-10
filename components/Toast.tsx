import React, { createContext, useContext, useState, useCallback, PropsWithChildren } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto dismiss unless loading, or error (long duration)
    const duration = type === 'loading' ? 0 : type === 'error' ? 6000 : 4000;
    
    if (duration > 0) {
        setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const clearToasts = () => setToasts([]);

  return (
    <ToastContext.Provider value={{ addToast, clearToasts }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md animate-in slide-in-from-right-full duration-300 ${
              toast.type === 'success' ? 'bg-green-50/90 dark:bg-green-900/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' :
              toast.type === 'error' ? 'bg-red-50/90 dark:bg-red-900/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' :
              toast.type === 'loading' ? 'bg-yellow-50/90 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200' :
              'bg-white/90 dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4" />}
            {toast.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
            <p className="text-sm font-medium max-w-[250px]">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-70"><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};