"use client";

import { Children, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";
import {
  ADMINISTRATIVE_EDGE_GUARD,
  ADMINISTRATIVE_SWIPE_THRESHOLD,
  administrativeCardPosition,
  boundedAdministrativeCard,
} from "./administrativeCarouselState";
import styles from "./AdministrativeCarousel.module.css";

export type AdministrativeCard = {
  id: string;
  label: string;
  content: ReactNode;
};

export default function AdministrativeCarousel({
  cards,
  ariaLabel,
  initialCardId,
  navigationMode = "steps",
  scrollMode = "card",
}: {
  cards: AdministrativeCard[];
  ariaLabel: string;
  initialCardId?: string;
  navigationMode?: "steps" | "sections" | "records";
  scrollMode?: "card" | "page";
}) {
  const initialIndex = Math.max(
    0,
    cards.findIndex(({ id }) => id === initialCardId)
  );
  const [selectedIndex, setActiveIndex] = useState(initialIndex);
  const [recordId, setRecordId] = useState(cards[initialIndex]?.id);
  const activeIndex = navigationMode === "records"
    ? Math.max(0, cards.findIndex(card => card.id === recordId))
    : selectedIndex;
  const instanceId = useId();
  const [announcement, setAnnouncement] = useState("");
  const cardRef = useRef<HTMLElement>(null);
  const sectionNavRef = useRef<HTMLElement>(null);
  const sectionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeCard = cards[activeIndex];

  const moveTo = (index: number) => {
    const nextIndex = boundedAdministrativeCard(index, cards.length);
    if (nextIndex === activeIndex) return;
    setActiveIndex(nextIndex);
    setRecordId(cards[nextIndex]?.id);
    setAnnouncement(
      `${cards[nextIndex]?.label ?? "Card"}, ${administrativeCardPosition(nextIndex, cards.length)}`
    );
  };

  const { swipeHandlers } = useGuardedSwipe({
    onSwipeLeft: () => moveTo(activeIndex + 1),
    onSwipeRight: () => moveTo(activeIndex - 1),
    canSwipeLeft: activeIndex < cards.length - 1,
    canSwipeRight: activeIndex > 0,
    threshold: ADMINISTRATIVE_SWIPE_THRESHOLD,
    edgeGuard: ADMINISTRATIVE_EDGE_GUARD,
  });

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });

    const nav = sectionNavRef.current;
    const button = sectionButtonRefs.current[activeIndex];
    if (!nav || !button) return;

    const inset = 2;
    const buttonStart = button.offsetLeft;
    const buttonEnd = buttonStart + button.offsetWidth;
    const visibleStart = nav.scrollLeft;
    const visibleEnd = visibleStart + nav.clientWidth;

    if (buttonStart < visibleStart + inset) {
      nav.scrollTo({ left: Math.max(0, buttonStart - inset), behavior: "auto" });
    } else if (buttonEnd > visibleEnd - inset) {
      nav.scrollTo({
        left: buttonEnd - nav.clientWidth + inset,
        behavior: "auto",
      });
    }
  }, [activeIndex]);

  if (!activeCard) return null;

  return (
    <section className={styles.shell} aria-label={ariaLabel}>
      {navigationMode !== "records" && <nav
        ref={sectionNavRef}
        className={styles.sectionNav}
        aria-label={`${ariaLabel} sections`}
      >
        {cards.map((card, index) => (
          <button
            key={card.id}
            ref={(element) => {
              sectionButtonRefs.current[index] = element;
            }}
            type="button"
            className={styles.sectionButton}
            aria-current={
              index === activeIndex
                ? navigationMode === "steps"
                  ? "step"
                  : "page"
                : undefined
            }
            onClick={() => moveTo(index)}
          >
            {card.label}
          </button>
        ))}
      </nav>}

      <div className={styles.viewport} {...swipeHandlers}>
        {cards.map((card, index) => (
          <article
            key={card.id}
            ref={index === activeIndex ? cardRef : undefined}
            className={`${styles.card}${scrollMode === "page" ? ` ${styles.pageScrollCard}` : ""}`}
            hidden={index !== activeIndex}
            tabIndex={index === activeIndex ? -1 : undefined}
            aria-labelledby={`${instanceId}-administrative-card-${card.id}`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft") moveTo(activeIndex - 1);
              if (event.key === "ArrowRight") moveTo(activeIndex + 1);
            }}
          >
            <h2 id={`${instanceId}-administrative-card-${card.id}`} className={styles.cardHeading}>
              {card.label}
            </h2>
            {card.content}
          </article>
        ))}
      </div>

      {navigationMode === "records" ? (cards.length > 1 ? (
        <div className={styles.controls} aria-label="Carousel controls">
          <ChevronControl direction="left" treatment="carousel" aria-label="Previous card" disabled={activeIndex === 0} onClick={() => moveTo(activeIndex - 1)} />
          <span className={styles.position} aria-live="polite">{administrativeCardPosition(activeIndex, cards.length)}</span>
          <ChevronControl direction="right" treatment="carousel" aria-label="Next card" disabled={activeIndex === cards.length - 1} onClick={() => moveTo(activeIndex + 1)} />
        </div>
      ) : null) : <div className={styles.controls} aria-label="Carousel controls">
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => moveTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous card"
        >
          Previous
        </button>
        <span className={styles.position} aria-live="polite">
          {administrativeCardPosition(activeIndex, cards.length)}
        </span>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => moveTo(activeIndex + 1)}
          disabled={activeIndex === cards.length - 1}
          aria-label="Next card"
        >
          Next
        </button>
      </div>}
      <span className="visually-hidden" aria-live="polite">{announcement}</span>
    </section>
  );
}

export function AdministrativeCarouselSections({
  sections,
  children,
  ariaLabel,
  initialCardId,
}: {
  sections: Array<{ id: string; label: string }>;
  children: ReactNode;
  ariaLabel: string;
  initialCardId?: string;
}) {
  const content = Children.toArray(children);
  return (
    <AdministrativeCarousel
      ariaLabel={ariaLabel}
      initialCardId={initialCardId}
      navigationMode="sections"
      cards={sections.map((section, index) => ({
        ...section,
        content: content[index] ?? null,
      }))}
    />
  );
}
