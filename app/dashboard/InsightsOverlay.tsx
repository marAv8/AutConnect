"use client";

import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Info } from "lucide-react";
import {
  useInsights,
  type InsightResponse,
  type InsightSnapshot,
} from "./useInsights";
import {
  INSIGHT_LENSES,
  INSIGHT_LENS_LABELS,
  type InsightLens,
} from "@/app/libs/insights/lenses";
import type {
  InsightFinding,
  InsightSource,
} from "@/app/api/insights/insightSnapshotContract";
import { formatClinicalShortDateTime } from "@/app/libs/dateTime";
import { formatRole } from "@/app/libs/roles";
import { conciseFindingTitle } from "./findingPresentation";

type Props = {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
};

// Preserve the guarded question implementation while keeping the control out
// of the current supervisor experience. It can be restored deliberately with
// NEXT_PUBLIC_INSIGHTS_CONTEXTUAL_QUESTIONS=true.
const CONTEXTUAL_QUESTIONS_ENABLED =
  process.env.NEXT_PUBLIC_INSIGHTS_CONTEXTUAL_QUESTIONS === "true";

const overlayGlassStyle: CSSProperties = {
  background: "rgb(0 0 0 / 25%)",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
};

const overlayPanelStyle: CSSProperties = {
  background: "var(--note-neo-surface)",
  border: "none",
  boxShadow: "var(--note-neo-raised)",
};

const SOURCE_TYPE_LABELS: Record<InsightSource["recordType"], string> = {
  entry: "Clinical documentation",
  entryRevision: "Documentation revision",
  assessmentItem: "Structured measurement",
  abcObservation: "A-B-C observation",
  fieldObservation: "Field Observation",
  teamFocus: "Team Focus",
  caseSupportRequest: "Case Support request",
  caseSupportCase: "Case Support case",
  caseSupportEntry: "Case Support entry",
};

function evidenceStrengthLabel(finding: InsightFinding) {
  if (finding.evidenceStrength === "high") return "High evidence strength";
  if (finding.evidenceStrength === "medium") {
    return "Moderate evidence strength";
  }
  return "Limited evidence";
}

function classificationLabel(finding: InsightFinding) {
  return finding.classification === "observation"
    ? "Documented observation"
    : "Evidence-linked interpretation";
}

function FindingMetadataDisclosure({
  labels,
}: {
  labels: readonly string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const disclosureId = useId();

  if (!labels.length) return null;

  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !isExpanded) return;
        event.stopPropagation();
        setIsExpanded(false);
        event.currentTarget.querySelector("button")?.focus();
      }}
      style={{ display: "contents" }}
    >
      <button
        type="button"
        aria-controls={disclosureId}
        aria-expanded={isExpanded}
        aria-label="About this finding"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        style={{
          alignItems: "center",
          background: "transparent",
          border: 0,
          borderRadius: 999,
          color: "var(--insights-text-secondary)",
          cursor: "pointer",
          display: "inline-flex",
          height: 28,
          justifyContent: "center",
          padding: 0,
          width: 28,
        }}
      >
        <Info aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {isExpanded ? (
        <div
          id={disclosureId}
          role="note"
          style={{
            background: "var(--insights-evidence-surface)",
            border: "1px solid var(--insights-border)",
            borderRadius: 9,
            color: "var(--insights-text-secondary)",
            display: "grid",
            fontSize: 11,
            gap: 3,
            lineHeight: 1.4,
            gridColumn: "1 / -1",
            marginTop: 3,
            maxWidth: "min(100%, 280px)",
            padding: "8px 10px",
          }}
        >
          {labels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceRecord({ source }: { source: InsightSource }) {
  return (
    <div
      style={{
        background: "var(--insights-evidence-surface)",
        border: "1px solid var(--insights-border)",
        borderRadius: 10,
        display: "grid",
        gap: 4,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{source.label}</div>
      <div
        style={{
          color: "var(--insights-text-secondary)",
          fontSize: 11,
          lineHeight: 1.35,
        }}
      >
        {SOURCE_TYPE_LABELS[source.recordType]}
        {source.occurredAt
          ? ` · ${formatClinicalShortDateTime(source.occurredAt)}`
          : ""}
      </div>
      {source.provider ? (
        <div
          style={{
            color: "var(--insights-text-secondary)",
            fontSize: 12,
          }}
        >
          {source.provider.displayName} · {source.provider.role}
        </div>
      ) : null}
      {source.excerpt ? (
        <div
          style={{
            color: "var(--insights-text-body)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {source.excerpt}
        </div>
      ) : null}
    </div>
  );
}

function FindingCard({ finding }: { finding: InsightFinding }) {
  const displayTitle = conciseFindingTitle(finding.title);
  const metadataLabels = [
    evidenceStrengthLabel(finding),
    classificationLabel(finding),
  ];

  return (
    <article
      style={{
        background: "var(--insights-control-surface)",
        border: "1px solid var(--insights-border)",
        borderRadius: 14,
        display: "grid",
        gap: 9,
        padding: "14px 16px",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: 4,
          gridTemplateColumns: "minmax(0, auto) 28px",
          justifyContent: "start",
        }}
      >
        <h3 style={{ fontSize: 17, lineHeight: 1.3, margin: "3px 0 0" }}>
          {displayTitle}
        </h3>
        <FindingMetadataDisclosure labels={metadataLabels} />
      </div>

      <p
        style={{
          color: "var(--insights-text-body)",
          fontSize: 14,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {finding.statement}
      </p>

      {finding.limitations.length ? (
        <div
          style={{
            color: "var(--insights-text-muted)",
            display: "grid",
            fontSize: 12,
            gap: 3,
            lineHeight: 1.4,
          }}
        >
          {finding.limitations.map((limitation) => (
            <div key={limitation}>{limitation}</div>
          ))}
        </div>
      ) : null}

      <details style={{ marginTop: 2 }}>
        <summary
          style={{
            color: "var(--foreground)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 650,
            minHeight: 28,
          }}
        >
          View Sources
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {finding.supportingRecordCount > finding.sources.length ? (
            <div
              style={{
                color: "var(--insights-text-secondary)",
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              Showing {finding.sources.length} of {finding.supportingRecordCount}{" "}
              supporting sources.
            </div>
          ) : null}
          {finding.sources.map((source) => (
            <SourceRecord key={source.id} source={source} />
          ))}
        </div>
      </details>
    </article>
  );
}

function findingRenderKey(finding: InsightFinding, position: number) {
  return `${finding.id}:${finding.title}:${position}`;
}

const PATTERN_CONTRIBUTOR_ROLE_ORDER: Record<string, number> = {
  BehaviorTherapist: 1,
  SpeechPathologist: 2,
  OccupationalTherapist: 3,
  Educator: 4,
  Caregiver: 5,
  Supervisor: 6,
};

function PatternFindingGroups({ findings }: { findings: InsightFinding[] }) {
  const groups = new Map<
    string,
    { contributor: NonNullable<InsightFinding["contributor"]>; findings: InsightFinding[] }
  >();
  const ungrouped: InsightFinding[] = [];

  for (const finding of findings) {
    if (!finding.contributor) {
      ungrouped.push(finding);
      continue;
    }
    const key = `${finding.contributor.providerId}:${finding.contributor.kind}`;
    const group = groups.get(key) ?? {
      contributor: finding.contributor,
      findings: [],
    };
    group.findings.push(finding);
    groups.set(key, group);
  }

  const orderedGroups = [...groups.values()].sort(
    (left, right) =>
      (PATTERN_CONTRIBUTOR_ROLE_ORDER[left.contributor.role] ?? 99) -
        (PATTERN_CONTRIBUTOR_ROLE_ORDER[right.contributor.role] ?? 99) ||
      left.contributor.displayName.localeCompare(right.contributor.displayName)
  );

  return (
    <div style={{ display: "grid", gap: 10, width: "100%" }}>
      {orderedGroups.map(({ contributor, findings: groupFindings }) => (
        <details
          key={`${contributor.providerId}:${contributor.kind}`}
          style={{
            background: "var(--insights-evidence-surface)",
            border: "1px solid var(--insights-border)",
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {contributor.displayName} ·{" "}
            {contributor.kind === "caregiverContext"
              ? "Caretaker Context"
              : formatRole(contributor.role)}
            <span
              style={{
                color: "var(--insights-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                marginLeft: 8,
              }}
            >
              {groupFindings.length} supported pattern
              {groupFindings.length === 1 ? "" : "s"}
            </span>
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {groupFindings.map((finding, position) => (
              <FindingCard
                key={findingRenderKey(finding, position)}
                finding={finding}
              />
            ))}
          </div>
        </details>
      ))}
      {ungrouped.map((finding, position) => (
        <FindingCard
          key={findingRenderKey(finding, position)}
          finding={finding}
        />
      ))}
    </div>
  );
}

export default function InsightsOverlay({ clientId, isOpen, onClose }: Props) {
  const { ask, loadSnapshot } = useInsights(clientId);
  const [selectedLens, setSelectedLens] =
    useState<InsightLens>("observations");
  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [questionAnswer, setQuestionAnswer] =
    useState<InsightResponse | null>(null);
  const [questionError, setQuestionError] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || isAsking) return;
    setIsAsking(true);
    setQuestionError("");
    try {
      setQuestionAnswer(await ask(submittedQuestion, selectedLens));
    } catch (caught) {
      setQuestionAnswer(null);
      setQuestionError(
        caught instanceof Error
          ? caught.message
          : "Unable to answer this question."
      );
    } finally {
      setIsAsking(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    void loadSnapshot()
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load Insights."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, loadSnapshot]);

  if (!isOpen) return null;

  const selectedFindings = snapshot?.lenses[selectedLens].findings ?? [];
  const hasAnyFindings = snapshot
    ? INSIGHT_LENSES.some(
        (lens) => snapshot.lenses[lens].findings.length > 0
      )
    : false;

  return (
    <div
      className="insights-overlay-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        ...overlayGlassStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        isolation: "isolate",
      }}
      onClick={onClose}
    >
      <section
        className="insights-overlay-panel"
        aria-label="Client Insights"
        style={{
          ...overlayPanelStyle,
          width: "min(100%, 760px)",
          maxHeight: "min(88vh, 800px)",
          overflowY: "auto",
          borderRadius: 18,
          padding: "26px clamp(18px, 5vw, 34px) 30px",
          boxSizing: "border-box",
          display: "grid",
          justifyItems: "center",
          gap: 18,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="back-link overlay-client-back-control"
            aria-label="Back to Client"
          >
            Client
          </button>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 650 }}>
            Insights
          </h2>
          <span aria-hidden="true" />
        </div>

        <div
          aria-label="Insight lenses"
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
            gap: 8,
          }}
        >
          {INSIGHT_LENSES.map((lens) => {
            const selected = selectedLens === lens;
            return (
              <button
                key={lens}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedLens(lens)}
                style={{
                  background: selected
                    ? "var(--insights-control-selected)"
                    : "var(--insights-control-surface)",
                  border: selected
                    ? "1px solid var(--insights-border-selected)"
                    : "1px solid var(--insights-border)",
                  borderRadius: 12,
                  boxShadow: selected
                    ? "var(--insights-control-shadow)"
                    : "none",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 650,
                  minHeight: 48,
                  padding: "9px 8px",
                }}
              >
                {INSIGHT_LENS_LABELS[lens]}
              </button>
            );
          })}
        </div>

        <div
          className="insights-answer-viewport"
          aria-live="polite"
          aria-busy={isLoading}
          style={{ width: "100%" }}
        >
          {isLoading ? (
            <div className="insights-answer-status">
              Reviewing authorized client records…
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              style={{ color: "var(--danger)", fontSize: 15, lineHeight: 1.5 }}
            >
              {error}
            </div>
          ) : null}

          {!isLoading && !error && snapshot && !hasAnyFindings ? (
            <div className="insights-answer-status">
              No accessible evidence is available for this client.
            </div>
          ) : null}

          {!isLoading && !error && snapshot && hasAnyFindings ? (
            selectedFindings.length ? (
              <div
                className="insights-answer-content"
                style={{ display: "grid", gap: 10, width: "100%" }}
              >
                {selectedLens === "patterns" ? (
                  <PatternFindingGroups findings={selectedFindings} />
                ) : (
                  selectedFindings.map((finding, position) => (
                    <FindingCard
                      key={findingRenderKey(finding, position)}
                      finding={finding}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="insights-answer-status">
                {selectedLens === "significance"
                  ? "The current records support the patterns shown, but not an additional significance finding."
                  : "No supported findings are available for this lens from the current records."}
              </div>
            )
          ) : null}
        </div>

        {CONTEXTUAL_QUESTIONS_ENABLED && !isLoading && !error && snapshot ? (
          <form
            onSubmit={submitQuestion}
            style={{
              borderTop: "1px solid var(--insights-border)",
              display: "grid",
              gap: 10,
              paddingTop: 16,
              width: "100%",
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, margin: 0 }}>
                Ask a contextual question
              </h3>
              <p
                style={{
                  color: "var(--insights-text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.4,
                  margin: "4px 0 0",
                }}
              >
                Answers are limited to authorized records and available sources.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "minmax(0, 1fr) auto",
              }}
            >
              <input
                aria-label="Contextual Insights question"
                maxLength={500}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about the client records or a provider’s documented work"
                type="text"
                value={question}
                style={{
                  background: "var(--insights-control-surface)",
                  border: "1px solid var(--insights-border)",
                  borderRadius: 11,
                  color: "var(--foreground)",
                  font: "inherit",
                  minHeight: 44,
                  padding: "9px 12px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <button
                disabled={isAsking || !question.trim()}
                type="submit"
                style={{
                  background: "var(--insights-control-selected)",
                  border: "1px solid var(--insights-border-selected)",
                  borderRadius: 11,
                  color: "var(--foreground)",
                  cursor: isAsking ? "wait" : "pointer",
                  fontWeight: 700,
                  minHeight: 44,
                  padding: "9px 16px",
                }}
              >
                {isAsking ? "Reviewing…" : "Ask"}
              </button>
            </div>

            {questionError ? (
              <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
                {questionError}
              </div>
            ) : null}

            {questionAnswer ? (
              <article
                style={{
                  background: "var(--insights-control-surface)",
                  border: "1px solid var(--insights-border)",
                  borderRadius: 14,
                  display: "grid",
                  gap: 8,
                  padding: "14px 16px",
                }}
              >
                {questionAnswer.headline ? (
                  <h3 style={{ fontSize: 17, margin: 0 }}>
                    {questionAnswer.headline}
                  </h3>
                ) : null}
                <p
                  style={{
                    color: "var(--insights-text-body)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {questionAnswer.summary}
                </p>
                {questionAnswer.confidence ? (
                  <div
                    style={{
                      color: "var(--insights-text-secondary)",
                      fontSize: 11,
                    }}
                  >
                    {questionAnswer.confidence === "high"
                      ? "High confidence"
                      : questionAnswer.confidence === "medium"
                        ? "Moderate confidence"
                        : "Limited confidence"}
                  </div>
                ) : null}
                {questionAnswer.limitations?.map((limitation) => (
                  <div
                    key={limitation}
                    style={{
                      color: "var(--insights-text-muted)",
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {limitation}
                  </div>
                ))}
                {questionAnswer.evidence?.length ? (
                  <details>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 650,
                      }}
                    >
                      View Sources
                    </summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {questionAnswer.evidence.map((evidence, index) => (
                        <div
                          key={`${evidence.sourceId ?? evidence.label}-${index}`}
                          style={{
                            background: "var(--insights-evidence-surface)",
                            border: "1px solid var(--insights-border)",
                            borderRadius: 10,
                            display: "grid",
                            gap: 4,
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {evidence.label}
                          </div>
                          {evidence.date ? (
                            <div
                              style={{
                                color: "var(--insights-text-secondary)",
                                fontSize: 11,
                              }}
                            >
                              {formatClinicalShortDateTime(evidence.date)}
                            </div>
                          ) : null}
                          <div
                            style={{
                              color: "var(--insights-text-body)",
                              fontSize: 13,
                              lineHeight: 1.45,
                            }}
                          >
                            {evidence.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ) : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
