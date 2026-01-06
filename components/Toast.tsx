import React, { useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const icons = {
  success: <CheckCircle size={18} className="text-green-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-orange-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

const styles = {
  success: "border border-green-400/60 bg-green-600/80 backdrop-blur-sm",
  error: "border border-red-400/60 bg-red-600/80 backdrop-blur-sm",
  warning: "border border-orange-400/60 bg-orange-600/80 backdrop-blur-sm",
  info: "border border-blue-300/60 bg-blue-600/80 backdrop-blur-sm",
};

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg shadow-lg animate-in slide-in-from-right-full transition-all w-80 pointer-events-auto ${styles[toast.type]}`}
    >
      <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
      <p className="text-sm text-slate-50 font-medium flex-1 leading-tight drop-shadow-sm">
        {toast.message}
      </p>
      <button
        onClick={() => onClose(toast.id)}
        className="text-slate-500 hover:text-white transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};
