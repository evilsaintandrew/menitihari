import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("ui-choice", className)}>
      <input className="ui-choice-control" type="checkbox" {...props} />
      <span className="ui-choice-copy">
        <span className="ui-choice-label">{label}</span>
        {description && <span className="ui-choice-description">{description}</span>}
      </span>
    </label>
  );
}
