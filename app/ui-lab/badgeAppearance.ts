export type BadgeAppearance = {
  badgeColor: string;
  torusColor: string;
  depth: number;
  torusLift: number;
  torusTubeRatio: number;
  plusRadiusRatio: number;
  plusRimTubeRatio: number;
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
  depth: 0.12,
  torusLift: 0.062,
  torusTubeRatio: 0.02565,
  plusRadiusRatio: 0.3,
  plusRimTubeRatio: 0.0243,
  plusOverlap: 0.25,
  contactShadowOpacity: 0.52,
  diffuseShadowOpacity: 0.12,
};
