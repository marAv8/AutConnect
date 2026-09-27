export const FIRST_ACTIVATION_FLAG = "debugFirstActivation";

export function firstActivationLoginDestination(formData: FormData) {
  const values = formData.getAll(FIRST_ACTIVATION_FLAG);
  return values.length === 1 && values[0] === "1"
    ? "/dashboard?debugFirstActivation=1"
    : "/dashboard";
}

export function isFirstActivationDashboard(location: Pick<Location, "pathname" | "search">) {
  const values = new URLSearchParams(location.search).getAll(FIRST_ACTIVATION_FLAG);
  return location.pathname === "/dashboard" && values.length === 1 && values[0] === "1";
}

// Preserve only the diagnostic opt-in in the existing dashboard URL producers.
// No listener, storage, redirect parameter, or separate history owner is added.
export function preserveFirstActivationFlag(destination: string) {
  if (typeof window === "undefined" || !isFirstActivationDashboard(window.location)) return destination;
  if (destination !== "/dashboard" && !destination.startsWith("/dashboard?")) return destination;
  return `${destination}${destination.includes("?") ? "&" : "?"}debugFirstActivation=1`;
}
