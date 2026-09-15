const CONCISE_TITLE_RULES: ReadonlyArray<
  readonly [RegExp, (subject: string) => string]
> = [
  [/^Recorded pattern for\s+(.+)$/i, (subject) => subject],
  [
    /^Differing recorded trends for\s+(.+)$/i,
    (subject) => `${subject} — Differing Trends`,
  ],
  [
    /^Recorded mastery criterion for\s+(.+)$/i,
    (subject) => `${subject} — Mastery Criterion`,
  ],
  [
    /^Reopened goal record for\s+(.+)$/i,
    (subject) => `${subject} — Reopened Goal`,
  ],
  [/^Recent\s+(.+)$/i, (subject) => subject],
  [/^Accessible\s+(.+)$/i, (subject) => subject],
];

const CANONICAL_CONCISE_TITLES: Record<string, string> = {
  "case support context": "Case Support Context",
  "case support documentation": "Case Support Documentation",
  "completed documentation": "Completed Documentation",
  "field observation": "Field Observation",
  "field observations": "Field Observations",
};

export function conciseFindingTitle(title: string) {
  const normalizedTitle = title.trim();
  let conciseTitle = normalizedTitle;

  for (const [pattern, format] of CONCISE_TITLE_RULES) {
    const match = normalizedTitle.match(pattern);
    if (match?.[1]) {
      conciseTitle = format(match[1].trim());
      break;
    }
  }

  return CANONICAL_CONCISE_TITLES[conciseTitle.toLowerCase()] ?? conciseTitle;
}
