import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

import { cn } from "./cn";

type LinkProps = NextLinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export function TextLink({ className, ...props }: LinkProps) {
  return <NextLink className={cn("ui-text-link", className)} {...props} />;
}

export function NavLink({ className, active = false, ...props }: LinkProps & { active?: boolean }) {
  return (
    <NextLink
      aria-current={active ? "page" : undefined}
      className={cn("ui-nav-link", active && "ui-nav-link-active", className)}
      {...props}
    />
  );
}
