//app/portal/supervisor/edit-providers/EditProvidersClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClientCircle = {
  id: string;
  initials: string;
  name: string;
};

type Props = {
  assignedClients: ClientCircle[];
};

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
const HEADER_TO_LINK_GAP = 10;
const LINK_TO_CONTENT_GAP = 24;

export default function EditProvidersClient({
  assignedClients,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onClientClick = async (client: ClientCircle) => {
    if (busyId) return;

    setBusyId(client.id);
    try {
      router.push(`/portal/supervisor/edit-providers/${client.id}`);
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
          {assignedClients.map((client, index) => (
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
                className="glass-client-badge"
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

            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
