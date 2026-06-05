import {
  CLIENT_ORB_FONT_SIZE,
  CLIENT_ORB_SIZE,
  GRID_VISIBLE_COLUMNS,
  GRID_VISIBLE_ROWS,
  MODE_GRID_GAP,
  STATUS_BADGE_CLEARANCE,
} from "./layoutConfig";
import ModeContentFrame from "./ModeContentFrame";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  clients: Client[];
  palette: string[];
  initialsOf: (firstName: string, lastName: string) => string;
  animatedClientId?: string;
  onClientClick: (clientId: string) => void;
};

export default function GridClientView({
  clients,
  palette,
  initialsOf,
  animatedClientId,
  onClientClick,
}: Props) {
  const visibleWidth =
    CLIENT_ORB_SIZE * GRID_VISIBLE_COLUMNS + MODE_GRID_GAP * (GRID_VISIBLE_COLUMNS - 1);
  const visibleHeight =
    CLIENT_ORB_SIZE * GRID_VISIBLE_ROWS + MODE_GRID_GAP * (GRID_VISIBLE_ROWS - 1);

  return (
    <ModeContentFrame>
      <div
        className="client-cavity-tray"
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
            justifyContent: "center",
            gap: MODE_GRID_GAP,
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
              onClick={() => onClientClick(client.id)}
              style={{
                width: CLIENT_ORB_SIZE,
                height: CLIENT_ORB_SIZE,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                borderRadius: "50%",
                border: "none",
                background: palette[index % palette.length],
                color: "var(--foreground)",
                boxShadow: "var(--shadow-dashboard-sphere)",
                fontSize: CLIENT_ORB_FONT_SIZE,
                fontWeight: 500,
                cursor: "pointer",
                animation:
                  animatedClientId === client.id
                    ? "client-bubble-in 280ms ease-out"
                    : undefined,
              }}
              title={`${client.firstName} ${client.lastName}`}
            >
              {initialsOf(client.firstName, client.lastName)}
            </button>
          ))}
        </div>
      </div>
    </ModeContentFrame>
  );
}
