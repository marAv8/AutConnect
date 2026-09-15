export type DashboardOverlayType =
  | "view"
  | "add"
  | "update"
  | "abc"
  | "teamFocus"
  | "teamFocusView"
  | "clientHandoff"
  | "educatorTarget"
  | null;

const FOCUSED_DATA_ENTRY_OVERLAYS = new Set<DashboardOverlayType>([
  // Note history is focused reading, but uses the same explicit dock suppression.
  "view",
  "add",
  "update",
  "abc",
  "teamFocus",
  "educatorTarget",
]);

export function isDashboardFocusedDataEntry(overlayType: DashboardOverlayType) {
  return FOCUSED_DATA_ENTRY_OVERLAYS.has(overlayType);
}
