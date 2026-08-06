import { db } from "@/lib/db";
import { createClientWithProviders } from "@/app/actions/createClientWithProviders";
import Link from "next/link";
import CreateClientProvidersForm from "./CreateClientProvidersForm";

export default async function CreateClientPage() {
  const providers = await db.provider.findMany({
    where: {
      role: {
        in: [
          "Caregiver",
          "OccupationalTherapist",
          "SpeechPathologist",
          "BehaviorTherapist",
          "Educator",
        ],
      },
    },
    orderBy: { lastName: "asc" },
  });

  const roleOrder = [
    "Caregiver",
    "BehaviorTherapist",
    "Educator",
    "SpeechPathologist",
    "OccupationalTherapist",
  ];
  const HEADER_TO_LINK_GAP = 10;
  const LINK_TO_CONTENT_GAP = 24;

  return (
    <main
      className="provider-assignment-page"
      style={{
        padding: "0 32px 24px",
        height: "calc(100vh - 110px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginTop: HEADER_TO_LINK_GAP, marginBottom: LINK_TO_CONTENT_GAP }}>
        <Link href="/dashboard" className="back-link">
          Client List
        </Link>
      </div>
      <div
        className="provider-assignment-page-content"
        style={{ display: "flex", justifyContent: "center", height: "calc(100% - 58px)" }}
      >
        <div style={{ width: "100%", maxWidth: 1100, minHeight: 0 }}>
          <div
            className="paper-surface provider-assignment-panel"
            style={{
              width: "100%",
              height: "100%",
              padding: 28,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <CreateClientProvidersForm
              onSubmit={createClientWithProviders}
              providers={providers}
              roleOrder={roleOrder}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
