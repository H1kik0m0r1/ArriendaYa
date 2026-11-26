"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type Toast = {
  id: number;
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
};

const ToastCtx = createContext<{
  show: (message: string, type?: ToastType, action?: Toast["action"]) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info", action?: Toast["action"]) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((t) => [...t, { id, message, type, action }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm md:bottom-4"
      >
        {toasts.map((t) => {
          const Icon =
            t.type === "success" ? CheckCircle2 : t.type === "error" ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
                t.type === "success" ? "bg-primary-btn" : t.type === "error" ? "bg-red-600" : "bg-slate-800 border border-slate-700"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p>{t.message}</p>
                  {t.action && (
                    <button
                      type="button"
                      onClick={t.action.onClick}
                      className="mt-1.5 rounded bg-white/20 px-2.5 py-0.5 text-xs font-medium hover:bg-white/30"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar notificación"
                className="rounded p-0.5 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
