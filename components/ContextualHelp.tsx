"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export type ContextualHelpContent = {
  title: string;
  explanation: ReactNode;
  whenToUse?: ReactNode;
  example?: ReactNode;
  examples?: string[];
  notes?: ReactNode;
  links?: Array<{ label: string; href: string }>;
};

type ContextualHelpProps = ContextualHelpContent & {
  label?: ReactNode;
  align?: "center" | "left" | "right";
};

export function ContextualHelp({
  title,
  explanation,
  whenToUse,
  example,
  examples,
  notes,
  links = [],
  label,
  align = "center",
}: ContextualHelpProps) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeHelp = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", closeHelp);
    return () => document.removeEventListener("pointerdown", closeHelp);
  }, [open]);

  const popoverPosition =
    align === "left"
      ? { left: 0, transform: "none" }
      : align === "right"
        ? { right: 0, transform: "none" }
        : { left: "50%", transform: "translateX(-50%)" };

  return (
    <span
      ref={containerRef}
      data-contextual-help="true"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      {label ? <span>{label}</span> : null}
      <span
        role="button"
        tabIndex={0}
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={open ? helpId : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          minHeight: 28,
          borderRadius: "50%",
          background: "var(--glass)",
          boxShadow: "var(--shadow-soft)",
          color: "rgb(0 0 0 / 68%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Info size={15} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {open ? (
        <span
          id={helpId}
          role="dialog"
          aria-label={title}
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 8px)",
            width: 280,
            maxWidth: "min(280px, calc(100vw - 32px))",
            padding: 14,
            borderRadius: 14,
            background: "var(--surface-raised)",
            boxShadow: "var(--shadow-soft)",
            whiteSpace: "normal",
            textAlign: "left",
            display: "grid",
            gap: 9,
            ...popoverPosition,
          }}
        >
          <span style={{ fontWeight: 650 }}>{title}</span>
          <span style={{ fontSize: 13, fontWeight: 450, opacity: 0.78 }}>
            {explanation}
          </span>
          {whenToUse ? (
            <span style={{ fontSize: 13, fontWeight: 450, opacity: 0.72 }}>
              <strong style={{ fontWeight: 650 }}>Use when: </strong>
              {whenToUse}
            </span>
          ) : null}
          {example ? (
            <span style={{ fontSize: 13, fontWeight: 450, opacity: 0.72 }}>
              <strong style={{ fontWeight: 650 }}>Example: </strong>
              {example}
            </span>
          ) : null}
          {examples?.length ? (
            <span style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 450, opacity: 0.72 }}>
              <strong style={{ fontWeight: 650 }}>Examples</strong>
              <span style={{ display: "grid", gap: 3 }}>
                {examples.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </span>
            </span>
          ) : null}
          {notes ? (
            <span style={{ fontSize: 12, fontWeight: 450, opacity: 0.64 }}>
              {notes}
            </span>
          ) : null}
          {links.length > 0 ? (
            <span style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
              {links.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
