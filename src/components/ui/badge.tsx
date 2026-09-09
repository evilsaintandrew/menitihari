import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export function Badge({ tone = "neutral", className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cn("ui-badge", `ui-badge-${tone}`, className)} {...props}>{children}</span>;
}
