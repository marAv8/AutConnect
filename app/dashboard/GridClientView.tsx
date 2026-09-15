import {
  GRID_VISIBLE_COLUMNS,
  GRID_VISIBLE_ROWS,
  STATUS_BADGE_CLEARANCE,
} from "./layoutConfig";
import ModeContentFrame from "./ModeContentFrame";
import styles from "./GridClientView.module.css";
import type { DashboardClient } from "./dashboardClientTypes";

type Props = {
  clients: DashboardClient[];
  palette: string[];
  initialsOf: (firstName: string, lastName: string) => string;
  animatedClientId?: string;
  onClientClick: (clientId: string) => void;
  removalMode?: boolean;
  removableClientIds?: readonly string[];
  busyClientId?: string | null;
  onRemoveClient?: (clientId: string, name: string) => void;
};

export default function GridClientView({
  clients,
  palette,
  initialsOf,
  animatedClientId,
  onClientClick,
  removalMode = false,
  removableClientIds = [],
  busyClientId = null,
  onRemoveClient,
}: Props) {
  const removableClientIdSet = new Set(removableClientIds);

  return (
    <ModeContentFrame>
      <div
        className={styles.clientListScrollFrame}
        data-client-grid-mode={removalMode ? "remove" : "browse"}
        style={{
          width: "100%",
          maxWidth:
            "calc(var(--dashboard-grid-orb-size) * 2 + var(--dashboard-grid-gap) + 196px)",
          margin: "0 auto",
        }}
      >
        <div className={styles.clientListSurface} aria-hidden="true" />
        <div className={styles.clientListFades} aria-hidden="true" />
        <div
          className={`${styles.clientListScrollRegion} ${styles.containedScrollbar}`}
          style={{
            maxHeight: `calc(var(--dashboard-grid-orb-size) * ${GRID_VISIBLE_ROWS} + var(--dashboard-grid-gap) * ${GRID_VISIBLE_ROWS - 1} + ${STATUS_BADGE_CLEARANCE + 174}px)`,
            overflowY: "auto",
            overflowX: "hidden",
            padding: `${STATUS_BADGE_CLEARANCE + 40}px calc(var(--client-list-content-inset) + var(--client-list-scroll-gutter)) 92px`,
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
              gap: "var(--dashboard-grid-gap)",
              width: "100%",
              minHeight: `calc(var(--dashboard-grid-orb-size) * ${GRID_VISIBLE_ROWS} + var(--dashboard-grid-gap) * ${GRID_VISIBLE_ROWS - 1})`,
              alignContent:
                clients.length <= GRID_VISIBLE_COLUMNS ? "center" : "flex-start",
            }}
          >
            {clients.length === 0 && removalMode ? (
              <div className={styles.removalEmptyState} role="status">
                No assigned Clients remain.
              </div>
            ) : null}
            {clients.map((client, index) => {
              const clientName = `${client.firstName} ${client.lastName}`;
              const canRemove = removableClientIdSet.has(client.id);

              return (
                <div className={styles.clientBadgeSlot} key={client.id}>
                  <button
                    type="button"
                    className="glass-client-badge"
                    data-client-signal={
                      client.signal?.color !== "neutral" && client.signal?.isUnread
                        ? client.signal.color
                        : undefined
                    }
                    data-client-signal-status={
                      client.signal?.isUnread ? client.signal.status : undefined
                    }
                    aria-label={removalMode ? clientName : `Open ${clientName}`}
                    disabled={removalMode}
                    onClick={() => onClientClick(client.id)}
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      border: "none",
                      background: palette[index % palette.length],
                      color: "var(--foreground)",
                      boxShadow: "var(--shadow-dashboard-sphere)",
                      fontSize:
                        "clamp(34px, calc(var(--dashboard-grid-orb-size) * 0.283), 40px)",
                      fontWeight: 500,
                      cursor: removalMode ? "default" : "pointer",
                      animation:
                        animatedClientId === client.id
                          ? "client-bubble-in 280ms ease-out"
                          : undefined,
                    }}
                    title={initialsOf(client.firstName, client.lastName)}
                  >
                    {initialsOf(client.firstName, client.lastName)}
                  </button>
                  {removalMode && canRemove && onRemoveClient ? (
                    <button
                      type="button"
                      className={styles.removeClientControl}
                      aria-label={`Remove ${clientName} from your Dashboard`}
                      disabled={busyClientId === client.id}
                      aria-busy={busyClientId === client.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveClient(client.id, clientName);
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModeContentFrame>
  );
}
