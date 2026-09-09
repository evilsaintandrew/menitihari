"use client";

import { Dialog } from "./dialog";

export function BottomSheet(props: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props} className={`ui-bottom-sheet ${props.className ?? ""}`} />;
}
