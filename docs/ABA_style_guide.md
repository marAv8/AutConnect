ABA/Therapist Style Guide — Concise

Purpose
- Ensure generated insights read like clinician-written notes: objective, operational, measurable, and actionable.

Tone & voice
- Professional, concise, neutral, non-judgmental.
- Use clinical terms where appropriate; keep caregiver-friendly alternatives optional.

Structure for each insight
1. Header: Target behavior / Diagnostic focus (one line)
2. Observation: objective data (frequency, duration, rate, context/antecedents, consequences)
3. Interpretation: brief functional hypothesis or clinical implication
4. Recommendation: concrete, actionable intervention steps, measurement plan, and next data collection target

Preferred terminology
- "Target behavior" instead of "problem behavior" or "bad behavior"
- "Antecedent" (what happened before), "Consequence" (what followed)
- Measurement language: "frequency", "duration", "rate (per minute)", "percent of opportunities"
- "Functional communication training (FCT)", "differential reinforcement", "task analysis", "prompt hierarchy"

Phrasing templates
- Observation: "Target behavior: [label]. Observed [N] episodes across [M] sessions; mean duration ~[x] minutes; rate [y]/min during [context]. Antecedent: [trigger]. Consequence: [what followed]."
- Interpretation: "Data suggests [function hypothesis], given [evidence]."
- Recommendation: "Implement [intervention], with [measurement metric] collected each session; mastery criteria: [criteria]. Review in [timeframe]."

Short glossary (lay → ABA)
- "Gets upset" → "crying episodes / tantrums (frequency, duration)"
- "Won't do tasks" → "task refusal / noncompliance; measured as % of trials refusing"
- "Repeats words" → "echolalia / stereotypic vocalizations; rate per minute"
- "Praises more" → "differential reinforcement of alternative behavior (DRA) — provide specific praise contingent on target response"

Examples (before → after)
- Before: "The child got upset and stopped working."
- After: "Target behavior: crying and task refusal. Observed 4 episodes across 2 sessions; average duration 3 minutes. Antecedent: transition to table tasks. Consequence: caregiver attention. Recommendation: implement a brief transition routine, provide a 2-minute preferred item contingent on successful transition for 3 consecutive trials."

- Before: "He keeps repeating words sometimes."
- After: "Observed echolalia during free play; rate ~6/min. Recommend teaching a 2-step mand chain, replacing echolalia with labeled requests; measure rate weekly."

Implementation notes for engineers/product
- Add a prompt layer that: (1) injects the style guide instructions, (2) forces the structure (Header, Observation, Interpretation, Recommendation), and (3) prefers clinical terms with caregiver-friendly parentheses when toggled.
- Provide UI option: `Clinical` vs `Caregiver-friendly` tone. Default: `Clinical` for supervisor-facing insights.
- Log edits and clinician corrections to iteratively refine prompts.

Next actions
- Use these templates to update the insight-generation prompts and produce a mapping glossary file.
