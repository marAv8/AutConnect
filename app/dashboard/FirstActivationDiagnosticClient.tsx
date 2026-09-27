"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import installFirstActivationProbe from "@/diagnostics/provider-first-activation.js";
import startLocalTraceDelivery from "@/diagnostics/localTraceDelivery.js";
import type { FirstActivationProbe } from "@/diagnostics/firstActivationProbeTypes";
import { isFirstActivationDashboard } from "./firstActivationFlag";
import styles from "./FirstActivationDiagnostic.module.css";

const CAPTURE_INTERVAL_MS = 20_000;
const WIDTH = 278;
const HEIGHT = 36;

export default function FirstActivationDiagnosticClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enabled = isFirstActivationDashboard({ pathname, search: searchParams.toString() });
  return enabled ? <FirstActivationCapture /> : null;
}

function FirstActivationCapture() {
  const probeRef = useRef<FirstActivationProbe | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [sending, setSending] = useState(false);
  const downloadUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
  }, []);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (stopped || !isFirstActivationDashboard(window.location)) return;
    installFirstActivationProbe();
    if (process.env.NODE_ENV === "development") startLocalTraceDelivery();
    probeRef.current = window.__autConnectFirstActivationProbe;
    let mounted = true;
    const unsubscribe = probeRef.current?.onStop(() => {
      probeRef.current = undefined;
      // History may be written during React insertion effects. Recording stops
      // synchronously; defer only the diagnostic UI cleanup beyond that commit.
      queueMicrotask(() => {
        if (!mounted) return;
        setStopped(true);
        setFallback("");
        setCopied(false);
      });
    });
    return () => {
      mounted = false;
      unsubscribe?.();
      window.__autConnectLocalTraceDelivery?.stop();
      probeRef.current?.stop();
      probeRef.current = undefined;
    };
  }, [stopped]);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    // This timer controls only the optional export UI, never application input.
    const timer = window.setTimeout(() => setReady(true), Math.max(0, CAPTURE_INTERVAL_MS - (performance.now() - probe.startedAt)));
    return () => {
      window.clearTimeout(timer);
      setReady(false);
      setCopied(false);
      setFallback("");
    };
  }, [stopped]);

  useEffect(() => {
    if (!ready || stopped) return;
    const place = () => {
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const controlWidth = Math.min(WIDTH, width - 96);
      if (controlWidth < 200) { setPosition(null); return; }
      const left = (width - controlWidth) / 2;
      const rectangles = [...document.querySelectorAll<HTMLElement>(
        'button, a, input, select, textarea, [role="dialog"], [role="menu"], .app-user-header, .glass-client-badge, .glass-provider-badge, .dashboard-utility-footer-region'
      )].filter(node => !node.closest('[data-first-activation-diagnostic]') && getComputedStyle(node).visibility !== "hidden")
        .map(node => node.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
      let next = null;
      // Bounded scan of empty space; never cover a control/card to force export
      // availability. Re-evaluate after natural layout/menu changes if full.
      for (let top = 96; top + HEIGHT < height - 100; top += 4) {
        if (rectangles.every(box => left + controlWidth + 8 <= box.left || left - 8 >= box.right || top + HEIGHT + 8 <= box.top || top - 8 >= box.bottom)) {
          next = { left, top, width: controlWidth }; break;
        }
      }
      setPosition(previous => previous?.left === next?.left && previous?.top === next?.top && previous?.width === next?.width ? previous : next);
    };
    place();
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element) || !record.target.closest('[data-first-activation-diagnostic]'))) place();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "inert"] });
    window.addEventListener("resize", place, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [ready, stopped]);

  const captureExport = () => {
    const probe = probeRef.current;
    if (!probe) {
      setExportStatus("Recording unavailable. Reopen the diagnostic page.");
      return null;
    }
    try {
      const result = JSON.stringify(probe.read());
      const count = JSON.parse(result).length;
      setExportStatus(`${count} events captured`);
      return result;
    } catch {
      setExportStatus("Could not read recording. Report this message.");
      return null;
    }
  };
  const save = () => {
    const result = captureExport();
    if (result === null) return;
    try {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      const url = URL.createObjectURL(new Blob([result], { type: "application/json" }));
      downloadUrlRef.current = url;
      const link = document.createElement("a");
      link.href = url;
      link.download = "autconnect-diagnostic.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setFallback(result);
      setExportStatus("Save unavailable. Select and copy the text.");
    }
  };
  const sendToMac = async () => {
    if (sending) return;
    const result = captureExport();
    if (result === null) return;
    setSending(true);
    setExportStatus("Sending to this Mac…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/dev/diagnostic-trace", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: result,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const receipt = await response.json();
      setExportStatus(`Sent to Mac: ${receipt.received} events. Tell me “sent”.`);
    } catch {
      setExportStatus("Not sent. Tell me this message; recording is retained.");
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  };
  const copy = async () => {
    const result = captureExport();
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(result);
      if (!probeRef.current) return;
      setCopied(true);
      setFallback("");
    } catch {
      if (!probeRef.current) return;
      setCopied(false);
      setFallback(result);
      setExportStatus("Automatic copy unavailable. Use Save trace.");
    }
  };
  const stop = () => {
    window.__autConnectLocalTraceDelivery?.stop();
    probeRef.current?.stop();
    probeRef.current = undefined;
    setFallback("");
    setCopied(false);
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    downloadUrlRef.current = null;
    setExportStatus("");
    setStopped(true);
  };

  if (!ready || stopped || !position) return null;
  return createPortal(
    <div data-first-activation-diagnostic className={styles.layer} style={position}>
      {process.env.NODE_ENV === "development" ?
        <button type="button" className={styles.button} disabled={sending} onClick={() => void sendToMac()} aria-label="Send diagnostic trace to Mac">{sending ? "Sending…" : "Send to Mac"}</button> :
        <button type="button" className={styles.button} onClick={save} aria-label="Save diagnostic trace">Save trace</button>}
      <button type="button" className={styles.button} onClick={() => void copy()} aria-label="Copy diagnostic trace">
        {copied ? "Copied" : fallback ? "Copy" : "Copy diagnostic trace"}
      </button>
      {fallback ? <textarea readOnly className={styles.fallback} value={fallback} aria-label="Diagnostic trace — select all to copy" /> : null}
      <button type="button" className={styles.button} onClick={stop} aria-label="Stop and delete trace">Stop &amp; delete</button>
      {exportStatus ? <span role="status" className={styles.exportStatus}>{exportStatus}</span> : null}
    </div>, document.body
  );
}
