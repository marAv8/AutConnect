export type BadgeAppearance = {
  badgeColor: string;
  torusColor: string;
  insetRingColor: string;
  depth: number;
  torusLift: number;
  plusRadiusRatio: number;
  plusOverlap: number;
  contactShadowOpacity: number;
  diffuseShadowOpacity: number;
};

/**
 * Shared material settings for the isolated badge studies.
 * These values are intentionally centralized so visual adjustments can be made
 * without searching through dashboard or clinical workflow code.
 */
export const DEFAULT_BADGE_APPEARANCE: BadgeAppearance = {
  badgeColor: "#ffffff",
  torusColor: "#e5e9ed",
  insetRingColor: "#f1f3f5",
  depth: 0.12,
  torusLift: 0.062,
  plusRadiusRatio: 0.3,
  plusOverlap: 0.25,
  contactShadowOpacity: 0.52,
  diffuseShadowOpacity: 0.12,
};
