"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const SUCCESS_QUERY_KEYS = [
  "created",
  "saved",
  "coordinationSaved",
  "accessUpdated",
];

export function CaseSupportSuccessToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of SUCCESS_QUERY_KEYS) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url);

    const timer = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="case-support-success-toast"
      role="status"
      aria-live="polite"
    >
      <Check size={18} strokeWidth={2.4} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
