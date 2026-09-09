import type { SelectHTMLAttributes } from "react";

import { cn } from "./cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("ui-input ui-select", className)} {...props} />;
}
