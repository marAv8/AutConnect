import type { ClinicalEvent, NormalizableTeamFocus } from "./types";
import { eventId, isoDate, providerName } from "./helpers";

export function normalizeTeamFocus(teamFocus: NormalizableTeamFocus): ClinicalEvent[] {
  const content = teamFocus.content.trim();
  if (!content) return [];

  return [
    {
      id: eventId(teamFocus.id, "team-focus"),
      clientId: teamFocus.clientId,
      occurredAt: isoDate(teamFocus.updatedAt),
      source: {
        sourceType: "team_focus",
        providerId: teamFocus.authorId,
        providerName: providerName(teamFocus.author),
        providerRole: teamFocus.author.role,
      },
      category: "team_focus",
      eventType: "team_focus_published",
      title: teamFocus.title?.trim() || "Team Focus",
      summary: content,
      details: {
        title: teamFocus.title ?? null,
        content,
      },
      significance: "important",
      tags: ["team_focus", "supervisor_direction"],
    },
  ];
}
