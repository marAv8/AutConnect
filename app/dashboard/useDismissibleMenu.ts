"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closeDismissibleMenu,
  openDismissibleMenu,
  runDismissibleMenuAction,
  toggleDismissibleMenu,
} from "./dismissibleMenuState";

export function useDismissibleMenu() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openMenu = useCallback(
    () => openDismissibleMenu(openRef, setOpen),
    []
  );
  const closeMenu = useCallback(
    () => closeDismissibleMenu(openRef, setOpen),
    []
  );
  const toggleMenu = useCallback(
    () => toggleDismissibleMenu(openRef, setOpen),
    []
  );
  const runMenuAction = useCallback(
    (action: () => void) =>
      runDismissibleMenuAction(openRef, setOpen, action),
    []
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (closeMenu()) {
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  return {
    open,
    openMenu,
    closeMenu,
    toggleMenu,
    runMenuAction,
    triggerRef,
    menuRef,
  };
}
