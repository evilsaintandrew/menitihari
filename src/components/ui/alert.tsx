import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

export function Alert({ tone = "info", title, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("ui-alert", `ui-alert-${tone}`, className)} role={tone === "danger" ? "alert" : "status"} {...props}>
      <span aria-hidden="true" className="ui-alert-mark">{tone === "success" ? "✓" : tone === "danger" ? "!" : tone === "warning" ? "!" : "i"}</span>
      <div>
        {title && <p className="ui-alert-title">{title}</p>}
        <div className="ui-alert-content">{children}</div>
      </div>
    </div>
  );
}
