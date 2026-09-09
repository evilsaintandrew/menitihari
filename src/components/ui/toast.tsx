"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "./cn";

type ToastTone = "info" | "success" | "warning" | "danger";
type ToastItem = { id: number; title: string; description?: string; tone: ToastTone };
type ToastContextValue = { push: (toast: Omit<ToastItem, "id">) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return <ToastContext.Provider value={value}>{children}<ToastViewport items={items} onDismiss={(id) => setItems((current) => current.filter((item) => item.id !== id))} /></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-label="Notifikasi" className="ui-toast-viewport" role="region">
      {items.map((item) => (
        <div className={cn("ui-toast", `ui-toast-${item.tone}`)} key={item.id} role={item.tone === "danger" ? "alert" : "status"}>
          <div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
          <button aria-label={`Tutup notifikasi ${item.title}`} onClick={() => onDismiss(item.id)} type="button">×</button>
        </div>
      ))}
    </div>
  );
}
