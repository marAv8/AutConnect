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
