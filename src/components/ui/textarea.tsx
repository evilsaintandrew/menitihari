import type { TextareaHTMLAttributes } from "react";

import { cn } from "./cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("ui-input ui-textarea", className)} {...props} />;
}
