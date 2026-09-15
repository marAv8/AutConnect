export const ADMINISTRATIVE_SWIPE_THRESHOLD = 56;
export const ADMINISTRATIVE_EDGE_GUARD = 24;

export function boundedAdministrativeCard(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

export function administrativeCardPosition(index: number, count: number) {
  return `${boundedAdministrativeCard(index, count) + 1} of ${Math.max(count, 1)}`;
}

export function administrativeSwipeDirection(
  deltaX: number,
  deltaY: number,
  threshold = ADMINISTRATIVE_SWIPE_THRESHOLD
) {
  if (
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) <= Math.abs(deltaY) * 1.15
  ) {
    return null;
  }
  return deltaX < 0 ? "next" : "previous";
}

export function startsInsideBrowserEdge(
  clientX: number,
  viewportWidth: number,
  edgeGuard = ADMINISTRATIVE_EDGE_GUARD
) {
  return clientX <= edgeGuard || clientX >= viewportWidth - edgeGuard;
}
