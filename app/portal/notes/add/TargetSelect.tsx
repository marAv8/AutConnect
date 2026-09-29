"use client";

import type { ComponentProps } from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import styles from "./TargetSelect.module.css";

// Scoped to note/target workflows; other application selects remain unchanged.
export function TargetSelect({
  id, name, value, defaultValue, options, placeholder, required, disabled,
  ariaLabel, className, style, onValueChange,
}: ComponentProps<typeof MaterialSelect>) {
  const emptyOption = options.find((option) => option.value === "");
  const groups = new Map<string, typeof options>();
  for (const option of options) {
    if (!option.value) continue;
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return (
    <Select.Root
      name={name} value={value} defaultValue={defaultValue}
      required={required} disabled={disabled} onValueChange={onValueChange}
    >
      <Select.Trigger id={id} aria-label={ariaLabel}
        className={`${styles.trigger}${className ? ` ${className}` : ""}`} style={style}>
        <Select.Value placeholder={placeholder ?? emptyOption?.label ?? "Select"} />
        <Select.Icon className={styles.icon}><ChevronDown size={17} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={styles.menu} position="popper" sideOffset={6} collisionPadding={12}>
          <Select.ScrollUpButton className={styles.scroll}>⌃</Select.ScrollUpButton>
          <Select.Viewport className={styles.viewport}>
            {[...groups].map(([group, items]) => (
              <Select.Group key={group}>
                {group ? <Select.Label className={styles.label}>{group}</Select.Label> : null}
                {items.map((option) => (
                  <Select.Item key={option.value} value={option.value} disabled={option.disabled} className={styles.option}>
                    <Select.ItemIndicator className={styles.check}><Check size={16} /></Select.ItemIndicator>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className={styles.scroll}>⌄</Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
