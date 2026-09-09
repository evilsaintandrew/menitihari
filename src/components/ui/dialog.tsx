"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";

export function Dialog({ open, onClose, title, description, children, className }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus], button, input, select, textarea, a[href]");
    firstFocusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div aria-hidden="false" className="ui-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div aria-describedby={description ? "dialog-description" : undefined} aria-labelledby="dialog-title" aria-modal="true" className={cn("ui-dialog", className)} ref={dialogRef} role="dialog">
        <div className="ui-dialog-header">
          <div>
            <h2 className="ui-dialog-title" id="dialog-title">{title}</h2>
            {description && <p className="ui-dialog-description" id="dialog-description">{description}</p>}
          </div>
          <Button aria-label="Tutup dialog" className="ui-dialog-close" onClick={onClose} size="sm" variant="ghost">×</Button>
        </div>
        <div className="ui-dialog-body">{children}</div>
      </div>
    </div>
  );
}
