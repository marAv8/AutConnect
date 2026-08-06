import { db } from "@/lib/db";
import {
  evaluateClientSignalGateway,
  latestCompletedSessionDate,
} from "@/app/api/aiGateway/clientSignalGateway";
import { interpretClientSignalEvidence } from "@/app/api/aiGateway/clientSignalSemantics";
import type {
  ClientSignalSnapshot,
  SignalEntry,
  SignalSemanticEvidence,
} from "./types";

const HISTORY_DAYS = 365;

export async function buildDashboardClientSignals(input: {
  clientIds: string[];
  viewerProviderId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.clientIds.length === 0) return new Map<string, ClientSignalSnapshot>();
  const currentSessionStart = startOfLocalDay(now);
  const historyStart = new Date(currentSessionStart);
  historyStart.setDate(historyStart.getDate() - HISTORY_DAYS);

  const [records, requests, teamFocusRecords] = await Promise.all([
    db.entry.findMany({
      where: {
        clientId: { in: input.clientIds },
        date: { gte: historyStart, lt: currentSessionStart },
        status: "COMPLETED",
        visibility: "Shared",
      },
      orderBy: [{ date: "asc" }, { updatedAt: "asc" }],
      select: {
        id: true,
        clientId: true,
        providerId: true,
        date: true,
        note: true,
        client: { select: { firstName: true, lastName: true } },
        provider: { select: { role: true, firstName: true, lastName: true } },
        items: {
          select: {
            goalId: true,
            target: true,
            goal: true,
            score: true,
            rawValue: true,
            metricType: true,
            observation: true,
            goalDefinition: {
              select: {
                measurementProfile: true,
                targetValue: true,
                comparison: true,
              },
            },
          },
        },
        abcObservations: {
          select: { antecedent: true, behavior: true, consequence: true },
        },
      },
    }),
    db.caseSupportRequest.findMany({
      where: {
        clientId: { in: input.clientIds },
        createdAt: { lt: currentSessionStart },
      },
      select: {
        id: true,
        clientId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        concern: true,
        requestedSupport: true,
        linkedCase: { select: { status: true } },
      },
    }),
    db.teamFocus.findMany({
      where: {
        clientId: { in: input.clientIds },
        isActive: true,
        updatedAt: { gte: historyStart, lt: currentSessionStart },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientId: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    }),
  ]);

  const entriesByClient = new Map<string, SignalEntry[]>();
  const redactionTerms = new Set<string>();
  for (const record of records) {
    const entries = entriesByClient.get(record.clientId) ?? [];
    entries.push({
      id: record.id,
      providerId: record.providerId,
      providerRole: record.provider.role,
      date: record.date,
      note: record.note,
      items: record.items.map((item) => ({
        goalId: item.goalId,
        target: item.target,
        goal: item.goal,
        score: item.score,
        rawValue: item.rawValue,
        metricType: item.metricType,
        measurementProfile: item.goalDefinition?.measurementProfile,
        targetValue: item.goalDefinition?.targetValue,
        comparison: item.goalDefinition?.comparison,
        observation: item.observation,
      })),
      abcObservations: record.abcObservations,
    });
    entriesByClient.set(record.clientId, entries);
    addRedactionTerms(redactionTerms, [
      record.client.firstName,
      record.client.lastName,
      `${record.client.firstName} ${record.client.lastName}`,
      record.provider.firstName,
      record.provider.lastName,
      `${record.provider.firstName} ${record.provider.lastName}`,
    ]);
  }

  const targetSessionByClient = new Map<string, string>();
  for (const clientId of input.clientIds) {
    const targetSessionDate = latestCompletedSessionDate(
      entriesByClient.get(clientId) ?? [],
      currentSessionStart
    );
    if (targetSessionDate) targetSessionByClient.set(clientId, targetSessionDate);
  }

  const readFilters = Array.from(targetSessionByClient, ([clientId, sessionDate]) => ({
    clientId,
    sessionDate: startOfSessionKey(sessionDate),
  }));
  const reads = readFilters.length
    ? await db.clientSignalRead.findMany({
        where: {
          providerId: input.viewerProviderId,
          OR: readFilters,
        },
        select: { clientId: true, sessionDate: true },
      })
    : [];
  const readKeys = new Set(
    reads.map((read) => `${read.clientId}:${sessionKey(read.sessionDate)}`)
  );

  const semanticEntries = Array.from(entriesByClient.entries()).flatMap(
    ([clientId, entries]) => recentSignalEntries(
      entries,
      targetSessionByClient.get(clientId) ?? null
    )
  );
  const semanticEvidence = await interpretClientSignalEvidence({
    entries: semanticEntries,
    viewerProviderId: input.viewerProviderId,
    redactTerms: Array.from(redactionTerms),
  });
  const semanticsByClient = groupSemanticsByClient(entriesByClient, semanticEvidence);

  const latestTeamFocus = new Map<string, (typeof teamFocusRecords)[number]>();
  for (const teamFocus of teamFocusRecords) {
    if (!latestTeamFocus.has(teamFocus.clientId)) {
      latestTeamFocus.set(teamFocus.clientId, teamFocus);
    }
  }

  return new Map(
    input.clientIds.map((clientId) => {
      const targetSessionDate = targetSessionByClient.get(clientId) ?? null;
      if (!targetSessionDate) {
        return [clientId, emptySignal()] as const;
      }
      const signal = evaluateClientSignalGateway({
        targetSessionDate,
        entries: entriesByClient.get(clientId) ?? [],
        caseRequests: requests
          .filter((request) => request.clientId === clientId)
          .map((request) => ({
            ...request,
            linkedCaseStatus: request.linkedCase?.status ?? null,
          })),
        teamFocus: latestTeamFocus.get(clientId) ?? null,
        semanticEvidence: semanticsByClient.get(clientId) ?? [],
      });
      return [
        clientId,
        withSessionLifecycle(signal, {
          sessionDate: startOfSessionKey(targetSessionDate),
          isUnread: !readKeys.has(`${clientId}:${targetSessionDate}`),
        }),
      ] as const;
    })
  );
}

function recentSignalEntries(entries: SignalEntry[], targetSessionDate: string | null) {
  if (!targetSessionDate) return [];
  const dates = Array.from(new Set(entries
    .map((entry) => sessionKey(entry.date))
    .filter((date) => date <= targetSessionDate)))
    .sort()
    .slice(-3);
  return entries.filter((entry) => dates.includes(sessionKey(entry.date)));
}

function groupSemanticsByClient(
  entriesByClient: Map<string, SignalEntry[]>,
  evidence: SignalSemanticEvidence[]
) {
  const clientByEntry = new Map<string, string>();
  for (const [clientId, entries] of entriesByClient) {
    entries.forEach((entry) => clientByEntry.set(entry.id, clientId));
  }
  const grouped = new Map<string, SignalSemanticEvidence[]>();
  for (const item of evidence) {
    const clientId = clientByEntry.get(item.entryId);
    if (!clientId) continue;
    const items = grouped.get(clientId) ?? [];
    items.push(item);
    grouped.set(clientId, items);
  }
  return grouped;
}

function withSessionLifecycle(
  signal: ClientSignalSnapshot,
  lifecycle: { sessionDate: Date; isUnread: boolean }
): ClientSignalSnapshot {
  return {
    ...signal,
    sessionDate: lifecycle.sessionDate.toISOString(),
    expiresAt: null,
    isUnread: signal.color !== "neutral" && lifecycle.isUnread,
  };
}

function emptySignal(): ClientSignalSnapshot {
  return {
    sessionDate: null,
    color: "neutral",
    reason: "insufficient_session_evidence",
    explanation: "No completed shared session is available for a proposed color signal.",
    confidence: "low",
    observedAt: null,
    expiresAt: null,
    status: "proposed",
    requiresSupervisorReview: false,
    isUnread: false,
    evidence: [],
  };
}

function addRedactionTerms(target: Set<string>, values: string[]) {
  values.filter((value) => value.trim().length >= 2).forEach((value) => target.add(value));
}

function startOfSessionKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function sessionKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
