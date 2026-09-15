"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./page.module.css";

export default function InvitationInfo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      containerRef.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className={styles.infoControl}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!containerRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.infoButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(true)}
      >
        <Info aria-hidden="true" size={17} strokeWidth={2} />
      </button>
      {open ? (
        <span id={popoverId} role="note" className={styles.infoPopover}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
