//app/dashboard/MoreMenu.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function MoreMenu() {
  const [open, setOpen] = useState(false);

  return (
      <div
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
        }}
      >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="More"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "2px solid #6b1f4f",
          color: "#6b1f4f",
          background: "transparent",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ...
      </button>

      {open && (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <Link href="/portal/supervisor/create-client">Add Client</Link>
          <Link href="/portal/supervisor/edit-providers">Care Team</Link>
        </div>
      )}
    </div>
  );
}
