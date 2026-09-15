/**
 * Fixed coordinate system for the current client constellation design.
 * ClientOrbit supplies the relative containing block; provider nodes use these
 * coordinates as absolute children. Responsive redesign can replace this model
 * without touching note-state or provider-action logic.
 */

export const CLIENT_ORBIT_LAYOUT = {
  orbitSize: 430,
  providerDistance: 144,
  clientBadgeSize: 150,
  providerBadgeSize: 88,
  actionBadgeSize: 28,
} as const;

export const CLIENT_ORBIT_MAX_SCALE = 1.34;
export const CLIENT_ORBIT_VERTICAL_RESERVE = 110;
export const CLIENT_ORBIT_WIDE_VERTICAL_RESERVE = 80;
export const CLIENT_ORBIT_GROWTH_START = 700;
export const CLIENT_ORBIT_GROWTH_SPAN = 500;

export function responsiveClientOrbitScale(
  availableInline: number,
  availableBlock: number
) {
  const widthScale = availableInline / CLIENT_ORBIT_LAYOUT.orbitSize;
  const verticalReserve =
    availableInline <= CLIENT_ORBIT_GROWTH_START
      ? CLIENT_ORBIT_VERTICAL_RESERVE
      : CLIENT_ORBIT_WIDE_VERTICAL_RESERVE;
  const heightScale =
    availableBlock > verticalReserve + CLIENT_ORBIT_LAYOUT.providerBadgeSize
      ? (availableBlock - verticalReserve) / CLIENT_ORBIT_LAYOUT.orbitSize
      : Number.POSITIVE_INFINITY;
  const geometryLimitedInline = Math.min(
    availableInline,
    availableBlock * 1.55
  );
  const growthProgress = Math.max(
    0,
    Math.min(
      1,
      (geometryLimitedInline - CLIENT_ORBIT_GROWTH_START) /
        CLIENT_ORBIT_GROWTH_SPAN
    )
  );
  const responsiveMaximum =
    1 + growthProgress * (CLIENT_ORBIT_MAX_SCALE - 1);

  return Math.max(
    0,
    Math.min(widthScale, heightScale, responsiveMaximum, CLIENT_ORBIT_MAX_SCALE)
  );
}

export type ProviderActionPopoverPosition = {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  transformOrigin:
    | "top left"
    | "top center"
    | "top right"
    | "bottom left"
    | "bottom center"
    | "bottom right";
};

export function resolveProviderActionPopoverPosition(
  anchor: { left: number; top: number; right: number; bottom: number },
  viewport: { width: number; height: number },
  popoverWidth = 300,
  estimatedHeight = 320,
  gap = 12,
  edge = 16
): ProviderActionPopoverPosition {
  const anchorCenter = (anchor.left + anchor.right) / 2;
  const leftCandidate = anchor.left - gap - popoverWidth;
  const rightCandidate = anchor.right + gap;
  const canPlaceLeft = leftCandidate >= edge;
  const canPlaceRight = rightCandidate + popoverWidth <= viewport.width - edge;
  const preferLeft = anchorCenter <= viewport.width / 2;
  let left: number;
  let horizontalOrigin: "left" | "center" | "right";

  if ((preferLeft && canPlaceLeft) || (!canPlaceRight && canPlaceLeft)) {
    left = leftCandidate;
    horizontalOrigin = "right";
  } else if (canPlaceRight) {
    left = rightCandidate;
    horizontalOrigin = "left";
  } else {
    left = Math.max(
      edge,
      Math.min(
        anchorCenter - popoverWidth / 2,
        viewport.width - popoverWidth - edge
      )
    );
    horizontalOrigin = "center";
  }
  const belowSpace = viewport.height - anchor.bottom - gap - edge;
  const aboveSpace = anchor.top - gap - edge;
  const placeBelow =
    belowSpace >= estimatedHeight ||
    (aboveSpace < estimatedHeight && belowSpace >= aboveSpace);
  const availableHeight = Math.max(44, placeBelow ? belowSpace : aboveSpace);

  return placeBelow
    ? {
        left,
        top: anchor.bottom + gap,
        maxHeight: availableHeight,
        transformOrigin: `top ${horizontalOrigin}`,
      }
    : {
        left,
        bottom: viewport.height - anchor.top + gap,
        maxHeight: availableHeight,
        transformOrigin: `bottom ${horizontalOrigin}`,
      };
}

const providerLayouts: Record<number, Array<readonly [number, number]>> = {
  1: [[0, -1]],
  2: [
    [-1, 0],
    [1, 0],
  ],
  3: [
    [0, -1],
    [0.88, 0.56],
    [-0.88, 0.56],
  ],
  4: [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ],
  5: [
    [0, -1],
    [0.95, -0.3],
    [0.62, 0.82],
    [-0.62, 0.82],
    [-0.95, -0.3],
  ],
  6: [
    [0, -1],
    [0.88, -0.5],
    [0.88, 0.5],
    [0, 1],
    [-0.88, 0.5],
    [-0.88, -0.5],
  ],
  7: [
    [0, -1],
    [0.78, -0.62],
    [1, 0.16],
    [0.44, 0.9],
    [-0.44, 0.9],
    [-1, 0.16],
    [-0.78, -0.62],
  ],
  8: [
    [0, -1],
    [0.72, -0.72],
    [1, 0],
    [0.72, 0.72],
    [0, 1],
    [-0.72, 0.72],
    [-1, 0],
    [-0.72, -0.72],
  ],
};

export function providerOrbitPoint(index: number, count: number, distance: number) {
  const point = providerLayouts[count]?.[index];
  if (point) {
    return { x: point[0] * distance, y: point[1] * distance };
  }

  const angle = -Math.PI / 2 + (index / count) * 2 * Math.PI;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

export function preferredCurrentProviderSlot(count: number) {
  if (count <= 1) {
    return 0;
  }

  const upperLeftTarget = { x: -0.75, y: -0.65 };
  let preferredIndex = 0;
  let preferredDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const point = providerOrbitPoint(index, count, 1);
    const distance =
      (point.x - upperLeftTarget.x) ** 2 +
      (point.y - upperLeftTarget.y) ** 2;

    if (distance < preferredDistance) {
      preferredDistance = distance;
      preferredIndex = index;
    }
  }

  return preferredIndex;
}
