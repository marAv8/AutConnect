"use client";

import { ChevronControl } from "@/components/ui/ChevronControl";
import { Children, type ReactNode, useEffect, useState } from "react";
import styles from "./CaseSupportWorkspaceCarousel.module.css";

export function ProviderCaseSupportCarousel({
  initialCard,
  children,
}: {
  initialCard: number;
  children: ReactNode;
}) {
  const cards = Children.toArray(children);
  const lastCard = Math.max(0, cards.length - 1);
  const boundedInitialCard = Math.min(lastCard, Math.max(0, initialCard));
  const [activeCard, setActiveCard] = useState(boundedInitialCard);

  useEffect(() => {
    setActiveCard(boundedInitialCard);
  }, [boundedInitialCard]);

  return (
    <div className={styles.workspace}>
      <nav className={styles.navigation} aria-label="Provider Case Support">
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveCard((card) => Math.max(0, card - 1))}
          disabled={activeCard === 0}
          aria-label="Previous Case Support card"
        />
        <span aria-live="polite">
          {activeCard + 1} of {cards.length}
        </span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() =>
            setActiveCard((card) => Math.min(lastCard, card + 1))
          }
          disabled={activeCard === lastCard}
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
