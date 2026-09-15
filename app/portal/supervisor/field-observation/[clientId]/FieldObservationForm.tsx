"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { createFieldObservation } from "@/app/actions/manageFieldObservations";
import { formatAssignmentRole } from "@/app/libs/roles";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import { ContextualHelp } from "@/components/ContextualHelp";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";
import {
  establishFieldObservationDashboardOrigin,
  hasTrustedFieldObservationDashboardOrigin,
  runFieldObservationBackNavigation,
} from "@/app/dashboard/fieldObservationNavigation";
import {
  FIELD_OBSERVATION_CARD_COUNT,
  buildFieldObservationItemSnapshot,
  getFieldObservationCoverage,
  getFieldObservationCardIndex,
  getFieldObservationDashboardHref,
  isFieldObservationFinishEnabled,
  type FieldObservationRating,
  type FieldObservationSetting,
} from "@/lib/fieldObservation";
import styles from "./FieldObservationForm.module.css";

type ProviderOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type RubricCriterion = {
  key: string;
  label: string;
  description: string;
};

type RatingDefinition = {
  label: string;
  points: number | null;
};

type Props = {
  clientId: string;
  clientFirstName: string;
  providers: ProviderOption[];
  rubric: readonly RubricCriterion[];
  ratings: readonly FieldObservationRating[];
  ratingDefinitions: Record<FieldObservationRating, RatingDefinition>;
  settings: readonly FieldObservationSetting[];
  initialObservedAt: string;
};

function localDateTimeValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function settingLabel(setting: string) {
  return setting.charAt(0) + setting.slice(1).toLowerCase();
}

function emptyCriterionValues(rubric: readonly RubricCriterion[]) {
  return Object.fromEntries(rubric.map((criterion) => [criterion.key, ""]));
}

export default function FieldObservationForm({
  clientId,
  clientFirstName,
  providers,
  rubric,
  ratings,
  ratingDefinitions,
  settings,
  initialObservedAt,
}: Props) {
  const router = useRouter();
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [observedProviderId, setObservedProviderId] = useState("");
  const [observedAt, setObservedAt] = useState(() =>
    localDateTimeValue(initialObservedAt),
  );
  const [setting, setSetting] = useState<FieldObservationSetting | "">("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [criterionRatings, setCriterionRatings] = useState<Record<string, string>>(
    () => emptyCriterionValues(rubric),
  );
  const [coachingFocus, setCoachingFocus] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const coverage = useMemo(
    () => getFieldObservationCoverage(criterionRatings),
    [criterionRatings],
  );
  const finishEnabled = isFieldObservationFinishEnabled({
    observedProviderId,
    observedAt,
    setting,
    criterionRatings,
  });
  const dashboardHref = getFieldObservationDashboardHref(clientId);

  useLayoutEffect(() => {
    establishFieldObservationDashboardOrigin(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!confirmationOpen) return;
    dialogRef.current?.focus();
  }, [confirmationOpen]);

  const goToCard = (offset: number) => {
    setCurrentIndex((index) => getFieldObservationCardIndex(index, offset));
  };

  const observationSwipe = useGuardedSwipe({
    onSwipeLeft: () => goToCard(1),
    onSwipeRight: () => goToCard(-1),
    canSwipeLeft: currentIndex < FIELD_OBSERVATION_CARD_COUNT - 1,
    canSwipeRight: currentIndex > 0,
    edgeGuard: 24,
  });

  const closeConfirmation = () => {
    if (savingRef.current) return;
    setConfirmationOpen(false);
    setSaveState("idle");
    setFeedback("");
    requestAnimationFrame(() => finishButtonRef.current?.focus());
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !finishEnabled) return;

    const duration = durationMinutes ? Number(durationMinutes) : null;
    if (
      duration !== null &&
      (!Number.isInteger(duration) || duration < 1 || duration > 1440)
    ) {
      setSaveState("error");
      setFeedback("Duration must be a whole number between 1 and 1440 minutes.");
      return;
    }

    savingRef.current = true;
    setSaveState("saving");
    try {
      await createFieldObservation({
        clientId,
        observedProviderId,
        observedAt: new Date(observedAt),
        setting,
        durationMinutes: duration,
        strengths: null,
        coachingFocus,
        followUp: null,
        items: buildFieldObservationItemSnapshot(criterionRatings),
      });

      setConfirmationOpen(false);
      setShowSuccessToast(true);
      window.setTimeout(() => router.push(dashboardHref), 700);
    } catch (error) {
      savingRef.current = false;
      setSaveState("error");
      setFeedback(
        error instanceof Error && error.message
          ? error.message
          : "The Field Observation could not be saved. Please try again.",
      );
    }
  }

  const activeCriterion =
    currentIndex >= 1 && currentIndex <= rubric.length
      ? rubric[currentIndex - 1]
      : null;

  return (
    <form
      id="field-observation-form"
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
    >
      <header className={styles.pageHeader}>
        <div className={styles.backRow}>
          <Link
            href={dashboardHref}
            className="back-link"
            onClick={(event) => {
              runFieldObservationBackNavigation({
                event,
                clientId,
                hasTrustedOrigin:
                  hasTrustedFieldObservationDashboardOrigin(clientId),
                back: () => window.history.back(),
                replace: (href) => router.replace(href),
              });
            }}
          >
            Back
          </Link>
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Field Observation</h1>
        </div>
      </header>

      <div className={styles.pager} aria-label="Field Observation steps">
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => goToCard(-1)}
          disabled={currentIndex === 0}
          aria-label="Previous Field Observation card"
        />
        <div className={styles.pagerCount} aria-live="polite">
          {currentIndex + 1} of {FIELD_OBSERVATION_CARD_COUNT}
        </div>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() => goToCard(1)}
          disabled={currentIndex === FIELD_OBSERVATION_CARD_COUNT - 1}
          aria-label="Next Field Observation card"
        />
      </div>

      <div
        className={`${styles.card} paper-surface`}
        style={{
          touchAction: "pan-y",
          transform: `translateX(${observationSwipe.dragOffset}px)`,
          transition:
            observationSwipe.dragOffset === 0
              ? "transform 160ms ease-out"
              : "none",
        }}
        {...observationSwipe.swipeHandlers}
      >
        {currentIndex === 0 ? (
          <section className={styles.cardContent} aria-labelledby="observation-details">
            <h2 id="observation-details">Observation details</h2>
            {providers.length > 0 ? (
              <div className={styles.detailsGrid}>
                <label className={styles.field}>
                  <span>Observed provider</span>
                  <select
                    value={observedProviderId}
                    onChange={(event) => setObservedProviderId(event.target.value)}
                  >
                    <option value="">Select a provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {formatProviderDisplayName(
                          provider.firstName,
                          provider.lastName
                        )} — {formatAssignmentRole(provider.role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Date and time</span>
                  <input
                    type="datetime-local"
                    value={observedAt}
                    onChange={(event) => setObservedAt(event.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Setting</span>
                  <select
                    value={setting}
                    onChange={(event) =>
                      setSetting(event.target.value as FieldObservationSetting | "")
                    }
                  >
                    <option value="">Select a setting</option>
                    {settings.map((option) => (
                      <option key={option} value={option}>
                        {settingLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Optional duration</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    inputMode="numeric"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    placeholder="Minutes"
                  />
                </label>
              </div>
            ) : (
              <div className={styles.emptyNotice} role="status">
                No eligible providers are currently assigned to {clientFirstName}. Add an
                eligible provider to the client&apos;s care team before creating a Field
                Observation.
              </div>
            )}
          </section>
        ) : null}

        {activeCriterion ? (
          <section className={`${styles.cardContent} ${styles.criterionCard}`}>
            <div className={styles.criterionTitle}>
              <h2 id={`criterion-${activeCriterion.key}`}>{activeCriterion.label}</h2>
              <ContextualHelp
                title={activeCriterion.label}
                explanation={activeCriterion.description}
              />
            </div>
            <fieldset
              className={styles.ratingChoices}
              aria-labelledby={`criterion-${activeCriterion.key}`}
            >
              <legend className={styles.srOnly}>Rating</legend>
              {ratings.map((rating) => (
                <label
                  key={rating}
                  className={
                    criterionRatings[activeCriterion.key] === rating ||
                    (!criterionRatings[activeCriterion.key] && rating === "NOT_OBSERVED")
                      ? styles.ratingSelected
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name={`rating-${activeCriterion.key}`}
                    value={rating}
                    checked={
                      criterionRatings[activeCriterion.key] === rating ||
                      (!criterionRatings[activeCriterion.key] && rating === "NOT_OBSERVED")
                    }
                    onChange={() =>
                      setCriterionRatings((current) => ({
                        ...current,
                        [activeCriterion.key]: rating,
                      }))
                    }
                  />
                  <span>{ratingDefinitions[rating].label}</span>
                </label>
              ))}
            </fieldset>
          </section>
        ) : null}

        {currentIndex === FIELD_OBSERVATION_CARD_COUNT - 1 ? (
          <section className={`${styles.cardContent} ${styles.summaryCard}`} aria-labelledby="observation-summary">
            <div>
              <h2 id="observation-summary">Field Observation summary</h2>
              <p>
                Summarize the observation, strengths, coaching considerations, or
                follow-up.
              </p>
            </div>
            <label className={styles.noteField}>
              <span>Summary <small>Optional</small></span>
              <textarea
                rows={6}
                maxLength={5000}
                value={coachingFocus}
                onChange={(event) => setCoachingFocus(event.target.value)}
              />
            </label>
          </section>
        ) : null}

        <div className={styles.cardActionRow}>
          <div className={styles.finishGroup}>
            <span aria-live="polite">
              {coverage.assessedItemCount} assessed
            </span>
            <button
              ref={finishButtonRef}
              type="button"
              className={`${styles.finishButton} material-control`}
              disabled={!finishEnabled}
              onClick={() => {
                setSaveState("idle");
                setFeedback("");
                setConfirmationOpen(true);
              }}
            >
              Finish
            </button>
          </div>
        </div>

      </div>

      {confirmationOpen
        ? createPortal(
            <div className={styles.dialogBackdrop}>
              <div
                ref={dialogRef}
                className={`${styles.dialog} paper-surface`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="finish-observation-title"
                tabIndex={-1}
                onKeyDown={handleDialogKeyDown}
              >
                <div className={styles.dialogHeading}>
                  <h2 id="finish-observation-title">Finish Field Observation</h2>
                  <p>
                    {coverage.assessedItemCount} of {rubric.length} criteria assessed
                  </p>
                </div>
                <div className={styles.coverageSummary}>
                  <p>
                    {coverage.excludedItemCount} {coverage.excludedItemCount === 1 ? "criterion" : "criteria"} will be
                    recorded as Not assessed and excluded from fidelity.
                  </p>
                  <div>
                    <span>Current fidelity</span>
                    <strong>{coverage.fidelityPercent}%</strong>
                  </div>
                </div>
                <label className={styles.noteField}>
                  <span>Field Observation summary <small>Optional</small></span>
                  <small className={styles.helperText}>
                    Summarize the observation, strengths, coaching considerations, or follow-up.
                  </small>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={coachingFocus}
                    onChange={(event) => setCoachingFocus(event.target.value)}
                  />
                </label>
                {saveState === "error" ? (
                  <div className={styles.errorFeedback} role="alert" aria-live="assertive">
                    {feedback}
                  </div>
                ) : null}
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={`${styles.continueButton} material-control`}
                    onClick={closeConfirmation}
                    disabled={saveState === "saving"}
                  >
                    Continue observing
                  </button>
                  <button
                    type="submit"
                    form="field-observation-form"
                    className={`${styles.saveButton} material-control action-positive`}
                    disabled={saveState === "saving"}
                  >
                    {saveState === "saving" ? "Saving…" : "Save observation"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showSuccessToast
        ? createPortal(
            <div className={styles.successToast} role="status" aria-live="polite">
              Field Observation saved. Returning to dashboard…
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}
