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
  "#b8ccd6",
  "#d8b3ca",
  "#d8ae86",
  "#d8bfd3",
  "#8ea3bb",
  "#d7c18a",
  "#b29bab",
  "#89c68a",
  "#e4b4ea",
  "#8ac48a",
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
        <Link href="/dashboard" style={{ fontWeight: 600 }}>
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
                  color: "#222",
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
                        ? "2px solid #d93025"
                        : "2px solid #2e7d32",
                    color: mode === "remove" ? "#d93025" : "#2e7d32",
                    background: "#fff",
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
