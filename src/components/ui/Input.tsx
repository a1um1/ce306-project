import * as React from "react";
import styles from "./Input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  label?: React.ReactNode;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "lg",
      label,
      error,
      id,
      containerClassName,
      labelClassName,
      className,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || (label ? generatedId : undefined);

    const sizeInputClass =
      size === "sm"
        ? styles.inputSm
        : size === "md"
        ? styles.inputMd
        : styles.inputLg;

    const inputClasses = [
      styles.input,
      sizeInputClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const sizeLabelClass =
      size === "sm"
        ? styles.labelSm
        : size === "md"
        ? styles.labelMd
        : styles.labelLg;

    const labelClasses = [
      styles.label,
      sizeLabelClass,
      labelClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const containerClasses = [
      styles.inputGroup,
      styles[size],
      error ? styles.hasError : "",
      containerClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const inputElement = (
      <input ref={ref} id={inputId} className={inputClasses} {...props} />
    );

    if (!label && !error && !containerClassName) {
      return inputElement;
    }

    return (
      <div className={containerClasses}>
        {label ? (
          <label className={labelClasses} htmlFor={inputId}>
            {label}
          </label>
        ) : null}
        {inputElement}
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    );
  }
);

Input.displayName = "Input";
