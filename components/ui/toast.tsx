"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 sm:bottom-6 sm:right-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 pr-9 text-sm shadow-lg backdrop-blur animate-in slide-in-from-bottom-5 fade-in-0 min-w-[260px] max-w-xs relative",
              t.type === "success" && "bg-background border-primary/20 text-foreground",
              t.type === "error" && "bg-background border-destructive/20 text-foreground",
              t.type === "info" && "bg-background border-border text-foreground"
            )}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : t.type === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : null}
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 rounded p-1 opacity-60 hover:opacity-100"
              aria-label="Descartar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
