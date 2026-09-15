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
].join(",");

const SWIPE_ALLOWED_TARGET = "[data-swipe-allow='true']";
const SWIPE_IGNORED_TARGET = "[data-swipe-ignore='true']";

type GuardedSwipeOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  disabled?: boolean;
  threshold?: number;
  edgeGuard?: number;
  blockingSelector?: string;
};

export type SwipeAxis = "horizontal" | "vertical" | null;
export type SwipeDirection = "left" | "right" | null;

export function isWithinSwipeEdgeGuard(
  clientX: number,
  viewportWidth: number,
  edgeGuard: number
) {
  return (
    edgeGuard > 0 &&
    (clientX <= edgeGuard || clientX >= viewportWidth - edgeGuard)
  );
}

export function resolveSwipeAxis(
  currentAxis: SwipeAxis,
  deltaX: number,
  deltaY: number
): SwipeAxis {
  if (currentAxis || Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) {
    return currentAxis;
  }

  return Math.abs(deltaX) > Math.abs(deltaY) * 1.15
    ? "horizontal"
    : "vertical";
}

export function resolveSwipeDirection({
  axis,
  deltaX,
  deltaY,
  threshold,
  canSwipeLeft,
  canSwipeRight,
}: {
  axis: SwipeAxis;
  deltaX: number;
  deltaY: number;
  threshold: number;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
}): SwipeDirection {
  const isHorizontal =
    axis === "horizontal" &&
    Math.abs(deltaX) >= threshold &&
    Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

  if (!isHorizontal) return null;
  if (deltaX < 0 && canSwipeLeft) return "left";
  if (deltaX > 0 && canSwipeRight) return "right";
  return null;
}

export function useGuardedSwipe({
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  disabled = false,
  threshold = 56,
  edgeGuard = 0,
  blockingSelector = "[role='menu']",
}: GuardedSwipeOptions) {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const axisRef = useRef<SwipeAxis>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const resetTracking = () => {
    startRef.current = null;
    axisRef.current = null;
    setDragOffset(0);
  };

  const cancelGesture = () => {
    suppressClickRef.current = false;
    resetTracking();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) {
      // A second contact cancels the active gesture rather than allowing the
      // remaining pointer to complete an unexpected navigation.
      cancelGesture();
      return;
    }

    if (event.isPrimary && event.button === 0) {
      suppressClickRef.current = false;
    }

    const target = event.target instanceof Element ? event.target : null;
    const isExplicitlyIgnored = !!target?.closest(SWIPE_IGNORED_TARGET);
    const isAllowedSwipeSurface = !!target?.closest(SWIPE_ALLOWED_TARGET);
    const isInteractiveTarget = !!target?.closest(INTERACTIVE_TARGETS);
    const shouldPreserveInteractiveClick =
      isInteractiveTarget &&
      (event.pointerType === "mouse" || !isAllowedSwipeSurface);

    if (
      disabled ||
      event.button !== 0 ||
      isWithinSwipeEdgeGuard(event.clientX, window.innerWidth, edgeGuard) ||
      isExplicitlyIgnored ||
      shouldPreserveInteractiveClick ||
      (blockingSelector && document.querySelector(blockingSelector))
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

    axisRef.current = resolveSwipeAxis(axisRef.current, deltaX, deltaY);

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
      cancelGesture();
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const direction = resolveSwipeDirection({
      axis: axisRef.current,
      deltaX,
      deltaY,
      threshold,
      canSwipeLeft,
      canSwipeRight,
    });

    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      if (direction === "left") {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }

    // Clear tracking before releasing capture so the resulting lost-capture
    // event cannot erase the click suppression retained for a completed drag.
    resetTracking();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onLostPointerCapture = () => {
    const gestureWasInterrupted = startRef.current !== null;
    resetTracking();
    if (gestureWasInterrupted) {
      suppressClickRef.current = false;
    }
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
      onPointerCancel: cancelGesture,
      onLostPointerCapture,
      onClickCapture,
    },
  };
}
