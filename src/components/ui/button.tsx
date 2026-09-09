import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "ui-button-primary",
  secondary: "ui-button-secondary",
  ghost: "ui-button-ghost",
  danger: "ui-button-danger",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ui-button",
        variantClasses[variant],
        `ui-button-${size}`,
        fullWidth && "w-full",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
