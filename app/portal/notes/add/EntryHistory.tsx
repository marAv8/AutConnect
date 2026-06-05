import Link from "next/link";

type EntryHistoryProps = {
  clientId: string;
  clientInitials: string;
  note: string;
  date: Date;
  providerName: string;
  providerRole: string;
  scores?: Array<number | null>;
  canEdit?: boolean;
  editHref?: string;
};

export default function EntryHistory({
  clientId,
  clientInitials,
  note,
  date,
  providerName,
  providerRole,
  scores,
  canEdit = false,
  editHref,
}: EntryHistoryProps) {
  const numericScores =
    scores?.filter((score): score is number => typeof score === "number") ?? [];
  const showDailyPerformance = numericScores.length === 7;
  const dailyPerformance = showDailyPerformance
    ? Math.round((numericScores.reduce((sum, score) => sum + score, 0) / (7 * 3)) * 100)
    : null;

  return (
    <div style={{ padding: "0 32px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/dashboard?clientId=${clientId}&view=orbit`}
          className="back-link"
        >
          Client
        </Link>
      </div>

      <div
        style={{
          margin: "0 auto",
          maxWidth: 980,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          className="paper-surface"
          style={{
            padding: 40,
            maxWidth: 500,
            width: "100%",
          }}
        >
          <div style={{ marginBottom: 16, opacity: 0.7 }}>
            <div>{clientInitials}</div>
            <div>
              {providerName} -- {providerRole}
            </div>
            <div>{new Date(date).toLocaleDateString()}</div>
          </div>

          <div
            style={{
              whiteSpace: "pre-wrap",
              border: "1px solid rgb(0 0 0 / 12%)",
              borderRadius: 14,
              padding: 12,
              marginBottom: 16,
            }}
          >
            {note}
          </div>

          {showDailyPerformance && dailyPerformance !== null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>
                Daily Performance
              </div>
              <div>{dailyPerformance}%</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {canEdit && editHref && (
              <Link href={editHref} prefetch={true}>
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
