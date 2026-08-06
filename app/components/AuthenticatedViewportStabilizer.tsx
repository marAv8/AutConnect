"use client";

import { useLayoutEffect } from "react";

/**
 * Older mobile Safari versions can restore a small document scroll offset when
 * an authenticated route mounts, making the header initially appear clipped.
 * Keep the authenticated workspace anchored to its true top on first paint.
 */
export default function AuthenticatedViewportStabilizer() {
  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const anchorToTop = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    anchorToTop();
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      anchorToTop();
      secondFrame = window.requestAnimationFrame(anchorToTop);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  return null;
}
