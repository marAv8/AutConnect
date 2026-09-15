"use client";

import { ChevronControl } from "@/components/ui/ChevronControl";
import { Children, type ReactNode, useEffect, useState } from "react";
import styles from "./CaseSupportWorkspaceCarousel.module.css";

const WORKSPACE_CARD_COUNT = 5;

export function CaseSupportWorkspaceCarousel({
  initialCard,
  children,
}: {
  initialCard: number;
  children: ReactNode;
}) {
  const cards = Children.toArray(children);
  const boundedInitialCard = Math.min(
    WORKSPACE_CARD_COUNT - 1,
    Math.max(0, initialCard)
  );
  const [activeCard, setActiveCard] = useState(boundedInitialCard);

  useEffect(() => {
    setActiveCard(boundedInitialCard);
  }, [boundedInitialCard]);

  return (
    <div className={styles.workspace}>
      <nav className={styles.navigation} aria-label="Case Support workspace">
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveCard((card) => Math.max(0, card - 1))}
          disabled={activeCard === 0}
          aria-label="Previous Case Support card"
        />
        <span aria-live="polite">
          {activeCard + 1} of {WORKSPACE_CARD_COUNT}
        </span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() =>
            setActiveCard((card) =>
              Math.min(WORKSPACE_CARD_COUNT - 1, card + 1)
            )
          }
          disabled={activeCard === WORKSPACE_CARD_COUNT - 1}
          aria-label="Next Case Support card"
        />
      </nav>

      <div className={styles.cards}>
        {cards.map((card, index) => (
          <div
            key={index}
            className={styles.cardSlot}
            hidden={index !== activeCard}
            aria-hidden={index !== activeCard}
          >
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}
