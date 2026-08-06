"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const INTERACTIVE_TARGETS = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  "summary",
  "details",
  "[contenteditable='true']",
  "[role='button']",
  "[role='menu']",
  "[data-swipe-ignore='true']",
  ".client-orbit-node",
].join(",");

type GuardedSwipeOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  disabled?: boolean;
  threshold?: number;
};

type SwipeAxis = "horizontal" | "vertical" | null;

export function useGuardedSwipe({
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  disabled = false,
  threshold = 56,
}: GuardedSwipeOptions) {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const axisRef = useRef<SwipeAxis>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const reset = () => {
    startRef.current = null;
    axisRef.current = null;
    setDragOffset(0);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.isPrimary && event.button === 0) {
      suppressClickRef.current = false;
    }

    if (
      disabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest(INTERACTIVE_TARGETS)) ||
      document.querySelector("[role='menu']")
    ) {
      return;
    }

    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    axisRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absoluteX = Math.abs(deltaX);
    const absoluteY = Math.abs(deltaY);

    if (!axisRef.current && Math.max(absoluteX, absoluteY) >= 8) {
      axisRef.current = absoluteX > absoluteY * 1.15 ? "horizontal" : "vertical";
    }

    if (axisRef.current !== "horizontal") {
      return;
    }

    suppressClickRef.current = absoluteX >= 10;
    event.preventDefault();
    const isBlockedEdge =
      (deltaX < 0 && !canSwipeLeft) || (deltaX > 0 && !canSwipeRight);
    setDragOffset(isBlockedEdge ? deltaX * 0.18 : deltaX * 0.34);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      reset();
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontal =
      axisRef.current === "horizontal" &&
      Math.abs(deltaX) >= threshold &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (isHorizontal) {
      event.preventDefault();
      event.stopPropagation();
      if (deltaX < 0 && canSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && canSwipeRight) {
        onSwipeRight();
      }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reset();
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return {
    dragOffset,
    swipeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onLostPointerCapture: reset,
      onClickCapture,
    },
  };
}
