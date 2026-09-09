import type { ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";

export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return <div aria-label="Memuat" className={cn("ui-skeleton-stack", className)}>{Array.from({ length: lines }, (_, index) => <span className="ui-skeleton" key={index} />)}</div>;
}

export function EmptyState({ title, description, action, className }: { title: string; description: string; action?: ReactNode; className?: string }) {
  return <div className={cn("ui-state ui-empty-state", className)}><span aria-hidden="true" className="ui-state-icon">○</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ValidationMessage({ children }: { children: ReactNode }) {
  return <p className="ui-field-error" role="alert">{children}</p>;
}

export function ErrorState({ title = "Ada kendala", description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return <div className="ui-state ui-error-state"><span aria-hidden="true" className="ui-state-icon">!</span><h3>{title}</h3><p>{description}</p>{onRetry && <Button onClick={onRetry} variant="secondary">Coba lagi</Button>}</div>;
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return <div className="ui-offline-state" role="status"><span aria-hidden="true">⌁</span><div><strong>Koneksi bermasalah</strong><p>Status belum dapat dipastikan. Coba lagi saat koneksi membaik.</p></div>{onRetry && <Button onClick={onRetry} size="sm" variant="secondary">Coba lagi</Button>}</div>;
}

export function DestructiveConfirmation({ title, description, confirmLabel = "Hapus", onConfirm, onCancel }: { title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="ui-confirmation"><div><h3>{title}</h3><p>{description}</p></div><div className="ui-actions"><Button onClick={onCancel} variant="ghost">Batal</Button><Button onClick={onConfirm} variant="danger">{confirmLabel}</Button></div></div>;
}
