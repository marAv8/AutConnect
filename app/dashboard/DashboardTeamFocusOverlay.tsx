"use client";

import { useState } from "react";
import { updateTeamFocus } from "@/app/actions/updateTeamFocus";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardTeamFocus } from "./dashboardClientTypes";

type Props = {
  clientId: string;
  teamFocus?: DashboardTeamFocus | null;
  onClose: () => void;
  onSaved?: (teamFocus: DashboardTeamFocus) => void;
};

export default function DashboardTeamFocusOverlay({
  clientId,
  teamFocus,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(teamFocus?.title ?? "");
  const [content, setContent] = useState(teamFocus?.content ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("title", title);
    formData.append("content", content);

    setStatus("saving");
    const result = await updateTeamFocus(formData);
    if (!result.ok || !result.teamFocus) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    onSaved?.(result.teamFocus);
    // Let the updated client-specific signal settle before closing the editor.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(onClose);
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 18 }}>
      <div className="mb-2 flex items-center">
        <button type="button" onClick={onClose} className="back-link">
          Client
        </button>
      </div>

      <div
        className="paper-surface"
        style={{
          padding: "24px clamp(18px, 5vw, 40px) 28px",
          minHeight: 320,
          boxSizing: "border-box",
          display: "grid",
          alignContent: "center",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
          Team Focus
        </div>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Name this focus"
          aria-label="Team Focus name"
          style={{
            minHeight: 44,
            padding: "10px 12px",
            border: "none",
            boxSizing: "border-box",
          }}
        />
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="What should every provider keep in mind?"
          aria-label="Team Focus details"
          style={{
            minHeight: 132,
            padding: "12px 14px",
            resize: "none",
            border: "none",
            boxSizing: "border-box",
          }}
        />
        {teamFocus ? (
          <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.62 }}>
            Last updated by{" "}
            {formatProviderDisplayName(
              teamFocus.author.firstName,
              teamFocus.author.lastName
            )}
            {" · "}
            {formatTeamFocusTimestamp(teamFocus.createdAt)}
          </div>
        ) : null}
      </div>

      {teamFocus?.revisions?.length ? (
        <TeamFocusRevisionHistory revisions={teamFocus.revisions} />
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        <Button
          type="submit"
          className="material-control action-positive"
          disabled={status === "saving" || content.trim().length === 0}
        >
          {status === "saving" ? "Saving..." : "Save Team Focus"}
        </Button>
      </div>

      {status === "error" ? (
        <div style={{ textAlign: "center", opacity: 0.72 }}>
          Team Focus could not be saved.
        </div>
      ) : null}
    </form>
  );
}

function TeamFocusRevisionHistory({
  revisions,
}: {
  revisions: NonNullable<DashboardTeamFocus["revisions"]>;
}) {
  return (
    <details className="paper-surface" style={{ padding: "14px 18px" }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 650 }}>
        Earlier updates ({revisions.length})
      </summary>
      <div style={{ display: "grid", gap: 16, paddingTop: 16 }}>
        {revisions.map((revision) => (
          <article
            key={revision.id}
            style={{
              display: "grid",
              gap: 7,
              paddingTop: 14,
              borderTop: "1px solid var(--team-focus-divider)",
            }}
          >
            {revision.title ? (
              <div style={{ fontSize: 14, fontWeight: 650 }}>
                {revision.title}
              </div>
            ) : null}
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {revision.content}
            </div>
            <div style={{ fontSize: 12, opacity: 0.62 }}>
              {formatProviderDisplayName(
                revision.author.firstName,
                revision.author.lastName
              )}
              {" · "}
              {formatTeamFocusTimestamp(revision.createdAt)}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

function formatTeamFocusTimestamp(value: Date | string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
