"use client";

type Props = {
  onClose: () => void;
};

export default function DashboardProductGuide({ onClose }: Props) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        display: "grid",
        placeItems: "center",
        padding: 18,
        background: "rgb(0 0 0 / 20%)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="autconnect-guide-title"
        className="paper-surface dashboard-product-guide"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(calc(100vw - 36px), 560px)",
          maxHeight: "min(720px, calc(100dvh - 36px))",
          overflowY: "auto",
          padding: "28px 30px",
          boxSizing: "border-box",
          display: "grid",
          gap: 24,
        }}
      >
        <header style={{ display: "grid", gap: 8, textAlign: "center" }}>
          <h2
            id="autconnect-guide-title"
            style={{ margin: 0, fontSize: 25, fontWeight: 600 }}
          >
            Using AutConnect
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.68 }}>
            A shared view of the client&apos;s completed and developing session
            information.
          </p>
        </header>

        <GuideSection title="Client Summary">
          Previous Session opens first and contains the most recently completed
          session. Current Session updates as caregiver and provider information
          is submitted throughout the day.
        </GuideSection>

        <GuideSection title="Client badge signals">
          Blue marks a meaningful positive development. Amber-gold indicates
          information needing attention. Red indicates a serious, sustained
          condition requiring coordinated review. A neutral badge has no active
          color signal, but Client Summary may still contain notes and can
          always be opened. Opening Client Summary clears the current signal
          for you.
        </GuideSection>

        <GuideSection title="Provider badge signals">
          Provider signals identify current-session information available to
          read. They dim after you read the provider note and reset with the next
          documentation day.
        </GuideSection>

        <GuideSection title="Navigation">
          Open the client badge for Client Summary. Open a provider badge to
          view available notes or add your permitted documentation. Use the
          Client List control to return to the dashboard.
        </GuideSection>

        <button
          type="button"
          className="action-secondary"
          onClick={onClose}
          style={{ justifySelf: "center", minWidth: 118 }}
        >
          Close
        </button>
      </section>
    </div>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "grid", gap: 7 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.58, opacity: 0.76 }}>
        {children}
      </p>
    </section>
  );
}
