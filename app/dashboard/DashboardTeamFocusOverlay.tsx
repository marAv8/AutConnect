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
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const cardCount = 2;

  const prevCard = () => {
    setActiveIndex((current) => (current === 0 ? cardCount - 1 : current - 1));
  };

  const nextCard = () => {
    setActiveIndex((current) => (current === cardCount - 1 ? 0 : current + 1));
  };

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
    onClose();
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
          padding: "18px 22px 20px",
          height: 320,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 28,
            marginBottom: 12,
          }}
        >
          <Button type="button" variant="ghost" onClick={prevCard}>
            ‹
          </Button>
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>{activeIndex + 1} of {cardCount}</div>
          </div>
          <Button type="button" variant="ghost" onClick={nextCard}>
            ›
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            alignContent: "center",
            gap: 18,
            height: "calc(100% - 58px)",
            padding: "8px 18px 0",
            boxSizing: "border-box",
          }}
        >
          {activeIndex === 0 ? (
            <>
              <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                Focus Title
              </div>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Transition Independence"
                style={{
                  minHeight: 44,
                  padding: "10px 12px",
                  border: "none",
                  boxSizing: "border-box",
                }}
              />
            </>
          ) : null}

          {activeIndex === 1 ? (
            <>
              <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                Team Focus
              </div>
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What should every provider keep in mind?"
                style={{
                  minHeight: 122,
                  padding: "12px 14px",
                  resize: "none",
                  border: "none",
                  boxSizing: "border-box",
                }}
              />
            </>
          ) : null}
        </div>
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
