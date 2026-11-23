"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; type: "success" | "error" | "info"; action?: { label: string; onClick: () => void } };
const ToastCtx = createContext<{ show: (message: string, type?: Toast["type"], action?: Toast["action"]) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast["type"] = "info", action?: Toast["action"]) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
              t.type === "success" ? "bg-primary" : t.type === "error" ? "bg-red-600" : "bg-gray-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <span>{t.message}</span>
              {t.action && (
                <button onClick={t.action.onClick} className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium hover:bg-white/30">
                  {t.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
