import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function Radio({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("ui-choice", className)}>
      <input className="ui-choice-control ui-radio-control" type="radio" {...props} />
      <span className="ui-choice-copy">
        <span className="ui-choice-label">{label}</span>
        {description && <span className="ui-choice-description">{description}</span>}
      </span>
    </label>
  );
}
