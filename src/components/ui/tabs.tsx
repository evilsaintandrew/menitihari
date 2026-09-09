"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ items, defaultValue, className }: { items: TabItem[]; defaultValue?: string; className?: string }) {
  const baseId = useId();
  const [active, setActive] = useState(defaultValue ?? items[0]?.id);
  const current = items.find((item) => item.id === active) ?? items[0];

  if (!current) return null;

  return (
    <div className={cn("ui-tabs", className)}>
      <div aria-label="Sections" className="ui-tab-list" role="tablist">
        {items.map((item) => (
          <button
            aria-controls={`${baseId}-${item.id}-panel`}
            aria-selected={item.id === current.id}
            className={cn("ui-tab", item.id === current.id && "ui-tab-active")}
            id={`${baseId}-${item.id}-tab`}
            key={item.id}
            onClick={() => setActive(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-labelledby={`${baseId}-${current.id}-tab`} className="ui-tab-panel" id={`${baseId}-${current.id}-panel`} role="tabpanel">
        {current.content}
      </div>
    </div>
  );
}
