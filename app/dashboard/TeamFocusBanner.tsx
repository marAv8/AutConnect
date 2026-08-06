"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardTeamFocus } from "./dashboardClientTypes";
import styles from "./TeamFocusBanner.module.css";

type TeamFocusBannerProps = {
  teamFocus: DashboardTeamFocus;
  viewerProviderId: string;
  onOpen: () => void;
};

/**
 * Compact dashboard preview for the active supervisor Team Focus. It lives
 * above the client orbit and opens the existing full Team Focus reading view.
 */
export function TeamFocusBanner({
  teamFocus,
  viewerProviderId,
  onOpen,
}: TeamFocusBannerProps) {
  const title = teamFocus.title?.trim() || "Current team direction";
  const [isUpdated, setIsUpdated] = useState(false);
  const seenStorageKey = useMemo(
    () =>
      [
        "autconnect",
        "team-focus-seen",
        viewerProviderId,
        teamFocus.id,
        new Date(teamFocus.updatedAt).toISOString(),
      ].join(":"),
    [teamFocus.id, teamFocus.updatedAt, viewerProviderId]
  );

  useEffect(() => {
    setIsUpdated(window.localStorage.getItem(seenStorageKey) !== "true");
  }, [seenStorageKey]);

  const openTeamFocus = () => {
    window.localStorage.setItem(seenStorageKey, "true");
    setIsUpdated(false);
    onOpen();
  };

  return (
    <button
      type="button"
      className={`${styles.banner} ${isUpdated ? styles.updated : ""}`}
      onClick={openTeamFocus}
      aria-label={`Open Team Focus: ${title}`}
    >
      <span className={styles.copy}>
        <span className={styles.eyebrow}>
          {isUpdated ? "Updated Team Focus" : "Team Focus"}
        </span>
        <span className={styles.title}>{title}</span>
        <span className={styles.preview}>{teamFocus.content}</span>
      </span>
      <span className={styles.openIcon} aria-hidden="true">
        <ChevronRight size={17} strokeWidth={1.8} />
      </span>
    </button>
  );
}
