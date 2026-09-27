// Allow only the existing probe's fixed vocabulary, geometry and booleans.
// Reject arbitrary text, URLs, account identifiers and field values.
const keys = new Set('sequence at kind type phase target targetNode eventAt dispatchLagMs trusted defaultPrevented grid orbit providerMenu closingMenu providerBackdrop workflow guide inbox dark inertCount shells workspaceNode point expectedControls surfaces hit ancestors pointerCaptured provider supervisor present mode node category tag pointerEvents touchAction position opacity visibility display zIndex transformed inert disabled rect surface painted hitOwner ownsCenterHit callback capture label readyState performanceTypes persisted start duration'.split(' '));
const words = new Set('installed input state logpoint listener-add listener-remove history-push history-replace popstate pageshow pagehide performance pointerdown pointerup pointercancel gotpointercapture lostpointercapture touchstart touchend touchcancel click keydown window-capture document-capture document-bubble window document other unclassified guide more inbox theme provider-plus client-list grid-client guide-dialog inbox-menu provider-menu provider-backdrop workflow more-surface carousel dock footer stage workspace shell grid orbit loading interactive complete longtask event guide-handler inbox-handler theme-handler provider-menu-handler client-list-handler grid-client-handler provider-listener-attached provider-listener-cleaned owner-effect-active HTML BODY DIV SECTION MAIN NAV BUTTON A SPAN SVG PATH INPUT TEXTAREA SELECT HEADER FORM OTHER auto none manipulation pan-y pan-x pinch-zoom visible hidden collapse static relative absolute fixed sticky block inline inline-block flex inline-flex grid inline-grid contents flow-root list-item normal'.split(' '));
export function validLocalTrace(value: unknown): value is Record<string, unknown>[] {
  let remaining = 200_000;
  const valid = (item: unknown, depth = 0): boolean => {
    if (--remaining < 0 || depth > 10) return false;
    if (Array.isArray(item)) return item.length <= 600 && item.every(child => valid(child, depth + 1));
    if (typeof item === 'object' && item !== null) return Object.entries(item).every(([key, child]) => keys.has(key) && valid(child, depth + 1));
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'boolean') return true;
    return typeof item === 'string' && item.length <= 80 && (words.has(item) || /^-?\d+(\.\d+)?$/.test(item) || /^(pan-x|pan-y|pinch-zoom)( (pan-x|pan-y|pinch-zoom))+$/.test(item));
  };
  return Array.isArray(value) && value.length > 0 && value.length <= 600 && value.every(item => item && !Array.isArray(item) && typeof item === 'object' && Number.isFinite(item.sequence) && typeof item.kind === 'string') && valid(value);
}
