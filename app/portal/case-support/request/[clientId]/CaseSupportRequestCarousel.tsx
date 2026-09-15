"use client";

import { submitCaseSupportRequest } from "@/app/actions/manageCaseSupport";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { useRef, useState, type FormEvent } from "react";
import styles from "./CaseSupportRequestCarousel.module.css";

type SupervisorOption = {
  id: string;
  name: string;
};

type RequestErrors = Partial<
  Record<"title" | "occurredAt" | "recipientSupervisorId" | "concern" | "requestedSupport", string>
>;

export function CaseSupportRequestCarousel({
  clientId,
  supervisors,
}: {
  clientId: string;
  supervisors: SupervisorOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const [errors, setErrors] = useState<RequestErrors>({});

  function fieldValue(name: string) {
    const field = formRef.current?.elements.namedItem(name);
    return field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
      ? field.value
      : "";
  }

  function validateDetails() {
    const nextErrors: RequestErrors = {};
    const title = fieldValue("title").trim();
    const occurredAt = fieldValue("occurredAt");
    const recipientSupervisorId = fieldValue("recipientSupervisorId");

    if (title.length < 3 || title.length > 120) {
      nextErrors.title = "Enter a case title between 3 and 120 characters.";
    }
    if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
      nextErrors.occurredAt = "Enter the date and time the situation occurred.";
    }
    if (!recipientSupervisorId) {
      nextErrors.recipientSupervisorId = "Choose the supervisor who should receive this request.";
    }

    setErrors((current) => ({
      ...current,
      title: nextErrors.title,
      occurredAt: nextErrors.occurredAt,
      recipientSupervisorId: nextErrors.recipientSupervisorId,
    }));
    return Object.keys(nextErrors).length === 0;
  }

  function validateSupport() {
    const nextErrors: RequestErrors = {};
    const concern = fieldValue("concern").trim();
    const requestedSupport = fieldValue("requestedSupport").trim();

    if (concern.length < 10 || concern.length > 2000) {
      nextErrors.concern = "Describe what needs support in 10 to 2,000 characters.";
    }
    if (requestedSupport.length < 5 || requestedSupport.length > 1500) {
      nextErrors.requestedSupport = "Describe the desired outcome in 5 to 1,500 characters.";
    }

    setErrors((current) => ({
      ...current,
      concern: nextErrors.concern,
      requestedSupport: nextErrors.requestedSupport,
    }));
    return Object.keys(nextErrors).length === 0;
  }

  function showSupportCard() {
    if (validateDetails()) {
      setActiveCard(1);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const detailsValid = validateDetails();
    if (!detailsValid) {
      event.preventDefault();
      setActiveCard(0);
      return;
    }
    if (!validateSupport()) {
      event.preventDefault();
      setActiveCard(1);
    }
  }

  return (
    <form
      ref={formRef}
      action={submitCaseSupportRequest}
      className={styles.form}
      noValidate
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="clientId" value={clientId} />

      <nav className={styles.navigation} aria-label="Case Support request">
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveCard(0)}
          disabled={activeCard === 0}
          aria-label="Previous request card"
        />
        <span aria-live="polite">{activeCard + 1} of 2</span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={showSupportCard}
          disabled={activeCard === 1}
          aria-label="Next request card"
        />
      </nav>

      <div className={styles.cards}>
        <section
          className={`paper-surface case-support-card ${styles.card}`}
          hidden={activeCard !== 0}
          aria-hidden={activeCard !== 0}
        >
          <h2 className="case-support-section-title">Request details</h2>

          <label className="case-support-field">
            <span>Case title</span>
            <input
              name="title"
              type="text"
              minLength={3}
              maxLength={120}
              required
              aria-invalid={errors.title ? "true" : undefined}
              aria-describedby={errors.title ? "case-title-error" : undefined}
            />
            {errors.title ? (
              <small id="case-title-error" className={styles.error}>
                {errors.title}
              </small>
            ) : null}
          </label>

          <label className="case-support-field">
            <span>Date and time of event</span>
            <input
              name="occurredAt"
              type="datetime-local"
              required
              aria-invalid={errors.occurredAt ? "true" : undefined}
              aria-describedby={errors.occurredAt ? "occurred-at-error" : undefined}
            />
            {errors.occurredAt ? (
              <small id="occurred-at-error" className={styles.error}>
                {errors.occurredAt}
              </small>
            ) : null}
          </label>

          {supervisors.length === 1 ? (
            <div className="case-support-field">
              <span>Supervisor recipient</span>
              <p className="case-support-request-copy">{supervisors[0].name}</p>
              <input
                type="hidden"
                name="recipientSupervisorId"
                value={supervisors[0].id}
              />
            </div>
          ) : (
            <div className="case-support-field">
              <label
                htmlFor="recipientSupervisorId"
                className={styles.fieldLabel}
              >
                Supervisor recipient
              </label>
              <MaterialSelect
                id="recipientSupervisorId"
                name="recipientSupervisorId"
                placeholder="Choose a supervisor"
                required
                options={supervisors.map((supervisor) => ({
                  value: supervisor.id,
                  label: supervisor.name,
                }))}
              />
              {errors.recipientSupervisorId ? (
                <small className={styles.error}>
                  {errors.recipientSupervisorId}
                </small>
              ) : null}
            </div>
          )}
        </section>

        <section
          className={`paper-surface case-support-card ${styles.card}`}
          hidden={activeCard !== 1}
          aria-hidden={activeCard !== 1}
        >
          <h2 className="case-support-section-title">Support needed</h2>

          <label className="case-support-field">
            <span>What needs support?</span>
            <textarea
              name="concern"
              className="case-support-textarea"
              rows={5}
              minLength={10}
              maxLength={2000}
              required
              aria-invalid={errors.concern ? "true" : undefined}
              aria-describedby={errors.concern ? "concern-error" : undefined}
            />
            {errors.concern ? (
              <small id="concern-error" className={styles.error}>
                {errors.concern}
              </small>
            ) : null}
          </label>

          <label className="case-support-field">
            <span>Desired outcome</span>
            <textarea
              name="requestedSupport"
              className="case-support-textarea"
              rows={4}
              minLength={5}
              maxLength={1500}
              required
              aria-invalid={errors.requestedSupport ? "true" : undefined}
              aria-describedby={
                errors.requestedSupport ? "requested-support-error" : undefined
              }
            />
            {errors.requestedSupport ? (
              <small id="requested-support-error" className={styles.error}>
                {errors.requestedSupport}
              </small>
            ) : null}
          </label>

          <div className="case-support-primary-action">
            <button type="submit" className="material-control action-positive">
              Send Request
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
