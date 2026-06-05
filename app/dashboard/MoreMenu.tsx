//app/dashboard/MoreMenu.tsx
"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

const dotRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  height: 8,
};

const dotStyle: CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: "currentColor",
  display: "block",
};

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
        className="material-control"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          color: "var(--foreground)",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          boxShadow:
            "0 6px 6px rgb(0 0 0 / 24%), 0 1px 1px rgb(0 0 0 / 16%), -4px -4px 6px rgb(255 255 255 / 70%), inset 0 1px 0 rgb(255 255 255 / 62%)",
        }}
      >
        <span aria-hidden="true" style={dotRowStyle}>
          <span style={dotStyle} />
          <span style={dotStyle} />
          <span style={dotStyle} />
        </span>
      </button>

      {open && (
        <div
          className="paper-surface"
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            minWidth: 172,
            padding: "18px 20px",
          }}
        >
          <Link className="soft-link" href="/portal/supervisor/create-client">
            Add Client
          </Link>
          <Link className="soft-link" href="/portal/supervisor/edit-providers">
            Care Team
          </Link>
        </div>
      )}
    </div>
  );
}
