"use client";

/**
 * Stable carousel controls above the client orbit.
 * This component owns only the current-position display and navigation buttons;
 * ClientCarousel remains responsible for choosing the active client.
 */

type Props = {
  currentIndex: number;
  clientCount: number;
  showPosition: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

const NAV_BUTTON_SIZE = 44;

export function ClientCarouselNavigation({
  currentIndex,
  clientCount,
  showPosition,
  onPrevious,
  onNext,
}: Props) {
  const canNavigate = clientCount > 1;
  const buttonStyle = {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    lineHeight: 1,
    background: "none",
    border: "none",
    cursor: canNavigate ? "pointer" : "default",
    color: "rgb(0 0 0 / 60%)",
    opacity: canNavigate ? 1 : 0,
  } as const;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${NAV_BUTTON_SIZE}px minmax(72px, auto) ${NAV_BUTTON_SIZE}px`,
        alignItems: "center",
        justifyContent: "center",
        columnGap: 24,
        color: "rgb(0 0 0 / 64%)",
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canNavigate}
        style={buttonStyle}
        aria-label="Previous client"
      >
        ‹
      </button>

      <div style={{ textAlign: "center" }}>
        {showPosition ? `${currentIndex + 1} of ${clientCount}` : null}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNavigate}
        style={buttonStyle}
        aria-label="Next client"
      >
        ›
      </button>
    </div>
  );
}
