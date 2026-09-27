export type FirstActivationProbe = {
  startedAt: number;
  onStop: (callback: () => void) => () => void;
  read: () => Array<Record<string, unknown>>;
  snapshot: () => unknown;
  mark: (label: string) => void;
  stop: () => void;
};

declare global {
  interface Window {
    __autConnectLocalTraceDelivery?: { stop: () => void };
    __autConnectFirstActivationProbe?: FirstActivationProbe;
  }
}
