"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const helpId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeHelp = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", closeHelp);
    return () => document.removeEventListener("pointerdown", closeHelp);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      return;
    }

    const positionPopover = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 32);
      const desiredLeft =
        align === "left"
          ? rect.left
          : align === "right"
            ? rect.right - width
            : rect.left + rect.width / 2 - width / 2;
      const left = Math.min(
        Math.max(16, desiredLeft),
        window.innerWidth - width - 16
      );

      setPopoverPosition({
        top: rect.bottom + 8,
        left,
      });
    };

    positionPopover();
    window.addEventListener("resize", positionPopover);
    window.addEventListener("scroll", positionPopover, true);
    return () => {
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
    };
  }, [align, open]);

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
        aria-label={title.startsWith("About ") ? title : `About ${title}`}
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
          color: "var(--contextual-help-icon, rgb(0 0 0 / 68%))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Info size={15} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {open && popoverPosition
        ? createPortal(
            <span
              ref={popoverRef}
              id={helpId}
              role="dialog"
              aria-label={title}
              style={{
                position: "fixed",
                zIndex: 2147483647,
                top: popoverPosition.top,
                left: popoverPosition.left,
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
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
