"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  ARRIVAL_UTILITY_DURATION_MS,
  ARRIVAL_UTILITY_FIRST_DELAY_MS,
  ARRIVAL_UTILITY_STAGGER_MS,
  ARRIVAL_UTILITY_START_SCALE,
  ARRIVAL_FAST_SPRING_OMEGA,
  ARRIVAL_PROVIDER_DAMPING,
  springScaleKeyframes,
  type DashboardArrivalCoordinator,
} from "./clientListEntrance";

type Props = {
  arrivalCoordinator: DashboardArrivalCoordinator;
  children: ReactNode;
};

export default function DashboardArrivalUtilities({
  arrivalCoordinator,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(
        ".dashboard-round-icon-control--arrival"
      )
    );
    const visuals = controls
      .map((control) =>
        control.querySelector<HTMLElement>(
          ":scope > .dashboard-utility-arrival-visual"
        )
      )
      .filter((visual): visual is HTMLElement => visual !== null);

    let startFrame = 0;
    let timer = 0;
    let settled = false;
    const animations: Animation[] = [];
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };

    const settleFromInput = () => settle();
    const start = () => {
      if (
        settled ||
        visuals.length === 0 ||
        !arrivalCoordinator.shouldStart("utilities") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof visuals[0].animate !== "function"
      ) {
        return;
      }

      const frames = springScaleKeyframes(
        ARRIVAL_UTILITY_START_SCALE,
        ARRIVAL_UTILITY_DURATION_MS,
        ARRIVAL_PROVIDER_DAMPING,
        ARRIVAL_FAST_SPRING_OMEGA
      );

      try {
        visuals.forEach((visual, index) => {
          visual.classList.add("dashboard-arrival-utility");
          animations.push(
            visual.animate(frames, {
              duration: ARRIVAL_UTILITY_DURATION_MS,
              delay:
                ARRIVAL_UTILITY_FIRST_DELAY_MS +
                index * ARRIVAL_UTILITY_STAGGER_MS,
              easing: "linear",
              fill: "backwards",
            })
          );
        });
      } catch {
        settle();
        return;
      }

      document.addEventListener("pointerdown", settleFromInput, true);
      document.addEventListener("touchstart", settleFromInput, true);
      document.addEventListener("wheel", settleFromInput, { capture: true, passive: true });
      document.addEventListener("keydown", settleFromInput, true);
      document.addEventListener("focusin", settleFromInput, true);
      window.addEventListener("resize", settleFromInput, { passive: true });
      timer = window.setTimeout(
        settle,
        ARRIVAL_UTILITY_DURATION_MS +
          ARRIVAL_UTILITY_FIRST_DELAY_MS +
          (visuals.length - 1) * ARRIVAL_UTILITY_STAGGER_MS +
          40
      );
    };
    startFrame = window.requestAnimationFrame(start);

    return () => {
      window.cancelAnimationFrame(startFrame);
      settle();
      document.removeEventListener("pointerdown", settleFromInput, true);
      document.removeEventListener("touchstart", settleFromInput, true);
      document.removeEventListener("wheel", settleFromInput, true);
      document.removeEventListener("keydown", settleFromInput, true);
      document.removeEventListener("focusin", settleFromInput, true);
      window.removeEventListener("resize", settleFromInput);
      visuals.forEach((visual) =>
        visual.classList.remove("dashboard-arrival-utility")
      );
    };
  }, [arrivalCoordinator]);

  return (
    <div ref={rootRef} className="dashboard-arrival-utilities-root">
      {children}
    </div>
  );
}
