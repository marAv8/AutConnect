//app/portal/supervisor/edit-providers/EditProvidersClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addSupervisorClient,
  removeSupervisorClient,
} from "@/app/actions/manageSupervisorClients";

type ClientCircle = {
  id: string;
  initials: string;
  name: string;
};

type Props = {
  assignedClients: ClientCircle[];
  availableClients: ClientCircle[];
};

type Mode = "none" | "remove" | "add";

const palette = [
  "#e1e1e1",
  "#ededed",
  "#d9d9d9",
  "#f4f4f4",
  "#e6e6e6",
  "#eeeeee",
  "#d5d5d5",
  "#e4e4e4",
  "#dddddd",
  "#f0f0f0",
];
const CLIENT_ORB_SIZE = 120;
const CLIENT_ORB_FONT_SIZE = 34;
const STATUS_BADGE_SIZE = 30;
const STATUS_BADGE_OFFSET = -6;
const HEADER_TO_LINK_GAP = 10;
const LINK_TO_CONTENT_GAP = 24;

export default function EditProvidersClient({
  assignedClients,
  availableClients,
}: Props) {
  const router = useRouter();
  const [mode] = useState<Mode>("none");
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleClients = useMemo(
    () => (mode === "add" ? availableClients : assignedClients),
    [mode, availableClients, assignedClients]
  );

  const onClientClick = async (client: ClientCircle) => {
    if (busyId) return;

    if (mode === "none") {
      router.push(`/portal/supervisor/edit-providers/${client.id}`);
      return;
    }

    const actionVerb = mode === "remove" ? "remove" : "add";
    const ok = window.confirm(
      `Confirm ${actionVerb} client ${client.name}? This changes only supervisor assignments.`
    );
    if (!ok) return;

    setBusyId(client.id);
    try {
      if (mode === "remove") {
        await removeSupervisorClient(client.id);
      } else {
        await addSupervisorClient(client.id);
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main style={{ padding: "0 32px 24px" }}>
      <div style={{ marginBottom: LINK_TO_CONTENT_GAP, marginTop: HEADER_TO_LINK_GAP }}>
        <Link href="/dashboard" className="back-link">
          Client List
        </Link>
      </div>

      <section
        style={{
          width: "100%",
          minHeight: 620,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "flex-start",
            alignContent: "flex-start",
            gap: 24,
            marginTop: 0,
          }}
        >
          {visibleClients.map((client, index) => (
            <button
              key={client.id}
              type="button"
              onClick={() => void onClientClick(client)}
              disabled={busyId === client.id}
              title={client.name}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "grid",
                justifyItems: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: CLIENT_ORB_SIZE,
                  height: CLIENT_ORB_SIZE,
                  borderRadius: "50%",
                  background: palette[index % palette.length],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: CLIENT_ORB_FONT_SIZE,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-sphere)",
                }}
              >
                {client.initials}
              </div>

              {mode !== "none" && (
                <div
                  style={{
                    position: "absolute",
                    top: STATUS_BADGE_OFFSET,
                    right: STATUS_BADGE_OFFSET,
                    width: STATUS_BADGE_SIZE,
                    height: STATUS_BADGE_SIZE,
                    borderRadius: "50%",
                    border:
                      mode === "remove"
                        ? "1px solid rgb(0 0 0 / 34%)"
                        : "1px solid rgb(0 0 0 / 24%)",
                    color: mode === "remove" ? "var(--negative)" : "var(--positive)",
                    background: "var(--glass-strong)",
                    boxShadow: "var(--shadow-tactile)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  {mode === "remove" ? "−" : "+"}
                </div>
              )}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
