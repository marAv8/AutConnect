import {
  CLIENT_ORB_FONT_SIZE,
  CLIENT_ORB_SIZE,
  GRID_VISIBLE_COLUMNS,
  GRID_VISIBLE_ROWS,
  MODE_GRID_GAP,
  STATUS_BADGE_CLEARANCE,
  STATUS_BADGE_SIZE,
} from "./layoutConfig";
import ModeContentFrame from "./ModeContentFrame";
import administrativeStyles from "@/app/components/administrative/AdministrativeCarousel.module.css";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  clients: Client[];
  palette: string[];
  initialsOf: (firstName: string, lastName: string) => string;
  busyClientId: string | null;
  onClientClick: (clientId: string, name: string) => void;
};

export default function RemoveClientView({
  clients,
  palette,
  initialsOf,
  busyClientId,
  onClientClick,
}: Props) {
  const visibleWidth =
    CLIENT_ORB_SIZE * GRID_VISIBLE_COLUMNS + MODE_GRID_GAP * (GRID_VISIBLE_COLUMNS - 1);
  const visibleHeight =
    CLIENT_ORB_SIZE * GRID_VISIBLE_ROWS + MODE_GRID_GAP * (GRID_VISIBLE_ROWS - 1);
  const removeIconStaggerMs = 85;
  const removeIconInitialDelayMs = 10;

  return (
    <ModeContentFrame>
      <div
        className={`client-cavity-tray ${administrativeStyles.card}`}
        style={{
          width: "100%",
          maxWidth: visibleWidth + 196,
          margin: "0 auto",
          maxHeight: visibleHeight + STATUS_BADGE_CLEARANCE + 174,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `${STATUS_BADGE_CLEARANCE + 40}px clamp(32px, 7vw, 80px) 92px`,
          boxSizing: "border-box",
          scrollbarGutter: "stable both-edges",
        }}
      >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: MODE_GRID_GAP,
              justifyContent: "center",
              justifyItems: "center",
              alignItems: "center",
              width: "100%",
              minHeight: visibleHeight,
              alignContent:
                clients.length <= GRID_VISIBLE_COLUMNS ? "center" : "flex-start",
            }}
          >
            {clients.map((client, index) => (
              <button
                key={client.id}
                type="button"
                className="glass-client-badge"
                disabled={busyClientId === client.id}
                onClick={() =>
                  onClientClick(client.id, `${client.firstName} ${client.lastName}`)
                }
                style={{
                  width: CLIENT_ORB_SIZE,
                  height: CLIENT_ORB_SIZE,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  borderRadius: "50%",
                  border: "none",
                  background: palette[index % palette.length],
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-dashboard-sphere)",
                  fontSize: CLIENT_ORB_FONT_SIZE,
                  fontWeight: 500,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  overflow: "visible",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                {initialsOf(client.firstName, client.lastName)}
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    transform: "translate(28%, -28%)",
                    zIndex: 2,
                    width: STATUS_BADGE_SIZE,
                    height: STATUS_BADGE_SIZE,
                    borderRadius: "50%",
                    background: "var(--glass-strong)",
                    border: "none",
                    boxShadow: "var(--shadow-dashboard-badge)",
                    color: "var(--client-remove-action)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "client-remove-badge-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
                    animationDelay: `${index * removeIconStaggerMs + removeIconInitialDelayMs}ms`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 3,
                      borderRadius: 999,
                      background: "var(--client-remove-action)",
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
      </div>
    </ModeContentFrame>
  );
}
