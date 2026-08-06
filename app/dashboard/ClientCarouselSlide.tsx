"use client";

/**
 * Owns carousel-only movement so the orbit and its badge UI always render at
 * their final centered position. Badge changes should stay inside ClientOrbit.
 */

import type { ReactNode } from "react";
import { motion } from "motion/react";

type Props = {
  dragOffset: number;
  children: ReactNode;
};

export function ClientCarouselSlide({ dragOffset, children }: Props) {
  return (
    <motion.div
      initial={false}
      animate={{ x: dragOffset }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{
        width: "100%",
        display: "grid",
        justifyItems: "center",
        willChange: dragOffset === 0 ? "auto" : "transform",
      }}
    >
      {children}
    </motion.div>
  );
}
