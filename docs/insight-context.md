# Insight Context

`InsightContext` is the relational data object prepared for future AI-powered supervisor insights.

It is built before any summary, ranking, trend, or compliance response. The current deterministic insight responses still exist, but they now read from the context instead of directly querying flat entry rows.

## Purpose

The context preserves relationships that future AI reasoning will need:

- Client to assigned care team.
- Provider to sessions.
- Session to assessment items.
- Assessment item to goal, target, domain, metric, and value.
- Provider to domain performance over time.
- Provider to goal performance over time.
- Provider-to-provider overlap for shared targets and goals.
- Domain-level clinical picture.
- Goal-to-provider and provider-to-goal relationships.
- Collaboration, coverage, and continuity metrics.
- Future ABC and clinical event interpretation.

The context does not generate answers by itself.

## Relationship Matching

The relationship layer preserves clinician-entered labels exactly as display values.

For matching only, labels are normalized by:

- trimming whitespace
- lowercasing comparison keys
- collapsing repeated spaces
- normalizing simple punctuation differences

Normalized keys are never written back over raw targets, goals, notes, or labels.

Shared and related work is separated into match levels:

- `goalId`: exact linked goal id match, high confidence
- `targetGoal`: normalized target plus normalized goal match, high confidence
- `targetOnly`: normalized target match, medium confidence
- `domainOnly`: same normalized domain match, low confidence

Same-domain relationships are treated as related context only. They are not counted as exact shared goals.

## Properties

### `client`

Basic client identity and metadata.

Supports future questions about whose data is being interpreted and allows AI output to reference the client safely by context.

### `query`

The parsed supervisor question filters used to construct this context.

Includes provider role, metric type, date range, threshold, comparison, intent, and plain-language context tokens. This lets future AI distinguish raw clinical data from the user’s requested lens.

### `careTeam`

A readable list of assigned providers with provider name, account role, and client assignment role.

Supports questions like:

- Which provider is responsible for which area?
- Are all assigned providers contributing data?
- Which profession-specific patterns are represented?

### `providerAssignments`

Raw assignment-level relationship data between client and provider.

This preserves the client-specific role relationship instead of relying only on account-level provider role.

### `activeGoals`

Active, unmastered goal definitions for the client.

Each goal keeps its provider owner, domain, metric type, target value, comparison rule, and weight. This supports reasoning about goal ownership, mastery path, and whether providers are measuring comparable goals.

### `sessions`

The core relational section.

Each session preserves:

- session id
- service date
- note creation date
- author provider
- provider role
- note text
- final score
- assessment items

Each assessment item preserves:

- item id
- linked goal id
- target
- goal
- metric type
- domain
- raw value
- score
- support level
- normalized score
- change from baseline
- change from previous measurement
- trend direction
- low-data flag
- clinically small but positive change flag
- full linked goal metadata

This section supports future questions like:

- What happened in speech sessions?
- Which provider observed regression?
- Which goals appear across multiple sessions?
- Which notes contain qualitative evidence?

### `assessmentItems`

A relational index of all assessment items across sessions.

This makes item-level analysis easier while still preserving references back to session, provider, and goal.

Supports future grouping by target, domain, metric, or provider.

### `providerGoalSeries`

Time series grouped by provider and goal.

Shape:

`provider -> goal -> sessions -> values -> trend`

Supports future questions like:

- Which provider sees strongest progress on a specific goal?
- Which goals generalize across providers?
- Which goals are improving only with one profession?

### `providerDomainSeries`

Time series grouped by provider and clinical domain.

Shape:

`provider -> domain -> sessions -> average scores -> trend`

Supports future questions like:

- Which domains improve under which provider?
- Are communication gains stronger in speech than in home sessions?
- Are behavior trends different from adaptive trends?

### `performanceTrends`

Provider-level score trends across available sessions.

This preserves the current simple trend calculation while keeping it provider-specific.

Supports future comparisons like:

- Which provider sees strongest progress?
- Which provider sees weakest progress?
- Which providers have flat patterns?

### `abcEvents`

Structured ABC event slot.

Production code persists ABC observations as structured rows linked to the provider's daily entry. The target shape is:

- antecedent
- behavior
- consequence
- provider
- date
- linked session id

This will support future AI questions about behavior function, antecedent patterns, and response effectiveness.

### `clinicalEvents`

General event stream for structured clinical observations.

ABC events will also be represented here as typed clinical events once persisted. This leaves room for later event types such as caregiver training, program modification, supervision observation, or goal mastery event.

### `relationshipMetrics`

Provider relationship scaffolding.

Includes:

- provider pairs
- shared targets
- shared goals
- provider coverage by sessions, domains, and goals

Supports future questions like:

- Which providers have similar outcomes?
- Which providers are measuring the same targets?
- Which providers disagree?
- Which goals generalize across settings?

### `clinicalPicture`

Domain-oriented clinical index grouped into:

- `behavior`
- `communication`
- `occupational`
- `education`
- `caregiver`

Each section includes active targets and goal references split into:

- recently measured goals
- improving goals
- declining goals
- stable goals
- newly introduced goals
- inactive goals
- low-data goals

A low-data goal has fewer than three measured sessions. It may still be active or recently measured, but future reasoning should treat it as limited evidence.

This section is structured for future reasoning over clinical areas without requiring a model to scan every assessment item.

### `providerRelationships`

Provider-level relationship objects.

Each assigned provider includes:

- total sessions
- active goals
- domains worked
- average normalized performance
- strongest domains
- weakest domains
- consistency
- trend
- coverage

Coverage includes assigned providers even when they have zero sessions. It records `hasSessions`, `hasActiveGoals`, `daysSinceLastSession`, `domainsCovered`, and `goalsCovered`.

This section does not rank providers. It describes each provider’s own data footprint and participation.

### `providerOverlap`

Pairwise provider relationship index.

For every provider pair, the context records:

- shared goals
- shared targets
- shared domains
- exact shared goals
- related targets
- related domains
- relationship matches with `matchType` and `confidence`
- sessions on the same date
- goals unique to each provider
- domains unique to each provider

This supports future questions about whether providers are working on the same goals, targets, or domains.
Exact shared goals and related collaboration are intentionally separate.

### `goalRelationships`

Goal-centered relationship index.

Each goal includes:

- providers working on it
- domains
- session measurements
- average performance
- trend
- current status

`currentStatus` may be `active`, `inactive`, `mastered`, or `unlinked`.

This allows future logic to answer goal-centered questions without searching every session.

Goal and item series carry change fields:

- `changeFromBaseline`
- `changeFromPrevious`
- `trendDirection`
- `lowData`
- `clinicallySmallButPositiveChange`

These fields help future reasoning detect small, clinically meaningful movement even when the overall score is still low or data volume is limited.

### `domainRelationships`

Domain-centered relationship index.

Domains include:

- Behavior
- Communication
- Speech
- Occupational
- Education
- Caregiver
- Adaptive
- Regulation
- SkillAcquisition
- Other
- Unspecified

Each domain includes providers involved, active goals, average trend, recent activity, and session count.

### `behaviorRelationships`

Behavior-target relationship index for behavior-domain observations.

Each behavior target includes:

- sessions observed
- providers observing
- average frequency
- trend
- associated ABC events

No functional analysis is performed in this section.

### `collaborationMetrics`

Team relationship metrics focused on collaboration rather than provider scoring.

Includes:

- providers working on common goals
- providers working independently
- goals spanning multiple professions
- goals isolated to one provider
- exact shared goals
- related targets
- related domains
- care-team coverage
- missing provider participation

This section is designed to distinguish shared care-team activity from isolated work.
Common-goal rows include `matchType` and `confidence`; related target/domain rows are available separately for lower-confidence collaboration context.

### `continuityMetrics`

Continuity-of-care metrics.

Includes:

- days between sessions
- provider gaps
- goal continuity
- provider transitions
- missing follow-up

This supports future questions about whether a goal or care plan has been consistently followed.

### `relationshipSummary`

Small structured summary for diagnostics and future dashboard visualization.

Includes:

- total providers
- exact shared goals
- related targets
- related domains
- isolated goals
- collaborative goals
- active domains
- recent behavior targets
- provider coverage
- continuity score

### `clientSignalScore`

Single dashboard-ready client signal.

Shape:

- `normalizedTotalScore`: 0-100, or null when no scoreable data exists
- `trendDirection`: `up`, `down`, `flat`, or `insufficientData`
- `confidence`: `high`, `medium`, or `low`
- `contributingDomains`
- `contributingProviders`
- `lowDataWarning`
- `lastUpdatedAt`

The score uses normalized item scores rather than raw values. It combines metric types only after normalization, applies goal weights when available, and balances provider/domain contribution so one profession or metric type does not dominate only because it has more entries.

The central client badge or torus color should use `clientSignalScore.normalizedTotalScore`, optionally adjusted visually by `trendDirection` and `confidence`.

### `domainContributions`

Provider-domain contribution map computed from actual assessment items.

Each row includes:

- provider id, name, and role
- clinical domain
- assessment count
- session count
- normalized average
- goals covered
- targets covered
- last contribution date

This section does not assume that a profession owns a domain. If a behavior therapist measures communication targets, that provider contributes to the Communication domain.

### `questionContributors`

Providers with evidence relevant to the parsed supervisor question.

The builder uses parsed domain focus from the question, then matches that focus against actual assessment item domains. For example, communication questions use providers measuring Communication items, regardless of provider role.

Each contributor includes a `relevanceScore` based on:

- amount of relevant assessment data
- session count
- recency
- domain coverage
- normalized average

### `primaryContributors`

Highest-evidence subset of `questionContributors`.

Primary contributors emerge from data volume, recency, and domain coverage. Profession labels are included as metadata but do not determine ownership.

### `secondaryContributors`

Additional relevant contributors that have evidence for the question but are not in the primary contributor set.

### `precomputedStatistics`

Small, stable counts for quick inspection:

- session count
- assessment item count
- active goal count
- providers with sessions

This is not intended to replace relational reasoning. It is a summary index for UI and diagnostics.

## Future AI Integration

Future AI insight generation should use `InsightContext` as its only backend data payload.

Recommended flow:

1. Parse supervisor question.
2. Build `InsightContext`.
3. Run deterministic calculations where useful.
4. Pass selected context sections and computed statistics to the LLM.
5. Ask the LLM to reason over relationships, not raw notes alone.

The LLM should not query the database directly and should not receive flattened-only aggregates.
