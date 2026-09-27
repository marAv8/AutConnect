/* Loaded only for opted-in local development diagnostics. No UI dependency. */
function startLocalTraceDelivery() {
  if (window.__autConnectLocalTraceDelivery) return;
  const enabled = () => location.pathname === '/dashboard' && new URLSearchParams(location.search).getAll('debugFirstActivation').length === 1 && new URLSearchParams(location.search).get('debugFirstActivation') === '1';
  if (!enabled()) return;
  let stopped = false;
  let busy = false;
  let sends = 0;
  let controller;
  let requestTimeout;
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(requestTimeout);
    controller?.abort();
    delete window.__autConnectLocalTraceDelivery;
  };
  const deliver = async () => {
    if (stopped || busy) return;
    const probe = window.__autConnectFirstActivationProbe;
    if (!enabled() || !probe || ++sends > 24) { stop(); return; }
    busy = true;
    controller = new AbortController();
    requestTimeout = setTimeout(() => controller.abort(), 4000);
    try {
      const records = probe.read();
      await fetch('/api/dev/diagnostic-trace', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records), signal: controller.signal,
      });
    } catch {
      // Preserve the recording; temporary network errors must not affect input.
    } finally {
      clearTimeout(requestTimeout);
      busy = false;
    }
  };
  const timer = setInterval(deliver, 5000);
  window.__autConnectLocalTraceDelivery = { stop };
  void deliver();
}
if (typeof module === 'object' && module.exports) module.exports = startLocalTraceDelivery;
else startLocalTraceDelivery();
