import { createLink } from "@tanstack/react-router";
import * as React from "react";
import {
  getButtonClassName,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";

export interface ButtonAnchorProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
}

const BaseAnchor = React.forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
  (
    {
      variant = "secondary",
      size = "md",
      fullWidth = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <a
        ref={ref}
        className={getButtonClassName({
          variant,
          size,
          fullWidth,
          disabled,
          className,
        })}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        {...props}
      >
        {children}
      </a>
    );
  }
);

BaseAnchor.displayName = "BaseAnchor";

export const ButtonLink = createLink(BaseAnchor);
