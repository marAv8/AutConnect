"use client";

import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./MaterialSelect.module.css";

export type MaterialSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  options: MaterialSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  onValueChange?: (value: string) => void;
};

export function MaterialSelect({
  id,
  name,
  value,
  defaultValue,
  options,
  placeholder,
  required,
  disabled,
  ariaLabel,
  className,
  style,
  onValueChange,
}: Props) {
  const hasEmptyOption = options.some((option) => option.value === "");
  const resolvedOptions =
    placeholder && !hasEmptyOption
      ? [{ value: "", label: placeholder, disabled: true }, ...options]
      : options;

  return (
    <div
      className={`${styles.wrapper}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <select
        id={id}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue || undefined : undefined}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        className={styles.nativeSelect}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {resolvedOptions.map((option) => (
          <option key={option.value || "empty"} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={styles.icon}
        size={17}
        strokeWidth={2}
      />
    </div>
  );
}
