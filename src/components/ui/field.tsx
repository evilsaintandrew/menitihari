import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function Field({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("ui-field", className)} {...props} />;
}

export function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="ui-field-label">
      {children}
      {required && <span aria-hidden="true" className="ui-required">*</span>}
    </span>
  );
}

export function FieldHint({ children, className, ...props }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return <span className={cn("ui-field-hint", className)} {...props}>{children}</span>;
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return <span className="ui-field-error" id={id} role="alert">{children}</span>;
}
