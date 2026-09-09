import { cn } from "./cn";

export function Progress({ value, label, className }: { value: number; label?: string; className?: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("ui-progress-wrap", className)}>
      {label && <div className="ui-progress-label"><span>{label}</span><span>{safeValue}%</span></div>}
      <div aria-label={label ?? "Progress"} aria-valuemax={100} aria-valuemin={0} aria-valuenow={safeValue} className="ui-progress" role="progressbar">
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
