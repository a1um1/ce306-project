import * as React from "react";
import styles from "./Logo.module.css";

export type LogoSize = "sm" | "md" | "lg";
export type LogoLayout = "horizontal" | "vertical";

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: LogoSize;
  layout?: LogoLayout;
  showText?: boolean;
  text?: string;
  textAs?: "span" | "h1" | "h2" | "h3" | "p";
  imgSrc?: string;
}

const IMG_SIZES: Record<LogoSize, number> = {
  sm: 34,
  md: 40,
  lg: 70,
};

export function Logo({
  size = "sm",
  layout = "horizontal",
  showText = true,
  text = "PayTail",
  textAs: TextTag = "span",
  imgSrc = "/assets/logo-slip.svg",
  className,
  ...props
}: LogoProps) {
  const imgSize = IMG_SIZES[size];

  const rootClass = [
    styles.logo,
    styles[layout],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} {...props}>
      <span className={styles.logoMark}>
        <img
          src={imgSrc}
          alt=""
          width={imgSize}
          height={imgSize}
          className={styles.logoImg}
        />
      </span>
      {showText ? <TextTag className={styles.logoText}>{text}</TextTag> : null}
    </div>
  );
}
