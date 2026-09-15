"use client";

import { useLayoutEffect } from "react";

/**
 * Dashboard state lives inside a viewport-sized shell and must not inherit a
 * stale document offset when returning from a portal route. This intentionally
 * leaves the browser's scroll-restoration policy alone.
 */
export default function AuthenticatedViewportStabilizer() {
  useLayoutEffect(() => {
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
    };
  }, []);

  return null;
}
