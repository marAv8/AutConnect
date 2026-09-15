"use client";

import { useState } from "react";

export function ResolutionConfidenceControl() {
  const [confidence, setConfidence] = useState<"CONFIDENT" | "UNSURE" | null>(
    null
  );

  return (
    <fieldset className="case-support-resolution-confidence">
      <legend>
        How confident are you that the impact has been understood and
        addressed?
      </legend>
      <div className="case-support-resolution-options">
        <label>
          <input
            type="radio"
            name="resolutionConfidence"
            value="CONFIDENT"
            checked={confidence === "CONFIDENT"}
            onChange={() => setConfidence("CONFIDENT")}
            required
          />
          <span>Confident</span>
        </label>
        <label>
          <input
            type="radio"
            name="resolutionConfidence"
            value="UNSURE"
            checked={confidence === "UNSURE"}
            onChange={() => setConfidence("UNSURE")}
            required
          />
          <span>Unsure</span>
        </label>
      </div>
      {confidence === "UNSURE" ? (
        <p>Note any remaining uncertainty in the resolution summary.</p>
      ) : null}
    </fieldset>
  );
}
