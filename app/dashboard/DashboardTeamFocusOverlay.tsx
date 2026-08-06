"use client";

import { useState } from "react";
import { updateTeamFocus } from "@/app/actions/updateTeamFocus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TeamFocusData = {
  id: string;
  title?: string | null;
  content: string;
  displayStartedAt: Date | string;
  updatedAt: Date | string;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

type Props = {
  clientId: string;
  teamFocus?: TeamFocusData | null;
  onClose: () => void;
  onSaved?: (teamFocus: TeamFocusData) => void;
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
    // Let the updated banner settle behind the overlay before revealing it.
    // This avoids exposing the carousel's necessary layout update to the user.
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
      </div>

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
