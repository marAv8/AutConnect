"use client";

/**
 * Stable carousel controls above the client orbit.
 * This component owns only the current-position display and navigation buttons;
 * ClientCarousel remains responsible for choosing the active client.
 */

import { ChevronControl } from "@/components/ui/ChevronControl";

type Props = {
  currentIndex: number;
  clientCount: number;
  showPosition: boolean;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
};

const NAV_BUTTON_SIZE = 44;

export function ClientCarouselNavigation({
  currentIndex,
  clientCount,
  showPosition,
  onPrevious,
  onNext,
  canPrevious = true,
  canNext = true,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${NAV_BUTTON_SIZE}px minmax(72px, auto) ${NAV_BUTTON_SIZE}px`,
        alignItems: "center",
        justifyContent: "center",
        columnGap: 24,
        color: "var(--carousel-navigation-text, rgb(0 0 0 / 64%))",
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      <ChevronControl
        direction="left"
        treatment="carousel"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="Previous client"
      />

      <div style={{ textAlign: "center" }}>
        {showPosition ? `${currentIndex + 1} of ${clientCount}` : null}
      </div>

      <ChevronControl
        direction="right"
        treatment="carousel"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next client"
      />
    </div>
  );
}
