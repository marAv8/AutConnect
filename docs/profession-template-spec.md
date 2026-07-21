# Profession Template Specification

AutConnect profession templates provide discipline-specific clinical vocabulary while preserving the shared `AssessmentItem` data model.

Templates do not change the database schema. They supply target options, recommended metrics, domains, descriptions, and future tags to the generic Session Note workflow.

## Data Model

All professions still save session data into existing assessment item fields:

- `target`
- `goal`
- `metricType`
- `domain`
- `rawValue`
- `score`

Supported stored metric types are:

- `Percentage`
- `Frequency`
- `Duration`
- `Subjective`

Some clinical concepts such as cue level, assistance level, and independence level are represented as `Subjective` for now. Their intended clinical meaning is preserved in target descriptions and tags until the product adds a richer metric model.

## Measurement Taxonomy

A measurement label is not the same thing as a stored raw metric type.

Each profession-specific measurement option defines:

- `label`
- stored `metricType`
- `classification`
- `inputKind`
- `normalizationStrategy`
- recommended range
- direction: `higherIsBetter`, `lowerIsBetter`, or `goalDependent`
- optional ordinal scale labels

The stored metric types remain unchanged:

- `Percentage`
- `Frequency`
- `Duration`
- `Subjective`

No profession-specific database metric types are introduced.

### Mapping Rules

| Measurement label | Classification | Stored metricType | Input kind | Normalization |
| --- | --- | --- | --- | --- |
| Accuracy | percentage | Percentage | number | 0-100 percentage |
| Completion % | percentage | Percentage | number | 0-100 percentage |
| Fidelity | percentage | Percentage | number | 0-100 percentage |
| Intelligibility | percentage | Percentage | number | 0-100 percentage |
| Frequency | frequency | Frequency | number | count |
| Opportunities | frequency | Frequency | number | count |
| Repetitions | frequency | Frequency | number | count |
| Duration | duration | Duration | duration | seconds after input parsing |
| Latency | duration | Duration | duration | seconds, lower usually better |
| Prompt Level | ordinalScale | Subjective | ordinalScale | 0-5, lower usually better |
| Cue Level | ordinalScale | Subjective | ordinalScale | 0-5, lower usually better |
| Assistance Level | ordinalScale | Subjective | ordinalScale | 0-5, lower usually better |
| Participation | ordinalScale | Subjective | ordinalScale | 1-5, higher usually better |
| Tolerance | ordinalScale | Subjective | ordinalScale | 1-5, higher usually better |
| Intensity | ordinalScale | Subjective | ordinalScale | 1-5, lower usually better |
| Yes / No | boolean | Subjective | boolean | text note plus boolean-compatible label |
| Subjective | text | Subjective | text | text-only; not always scoreable |

### Ordinal Examples

Prompt Level uses a 0-5 scale:

| Value | Label |
| --- | --- |
| 0 | Independent |
| 1 | Gestural |
| 2 | Verbal |
| 3 | Model |
| 4 | Partial Physical |
| 5 | Full Physical |

Assistance Level uses a 0-5 scale:

| Value | Label |
| --- | --- |
| 0 | Independent |
| 1 | Supervision |
| 2 | Minimal |
| 3 | Moderate |
| 4 | Maximal |
| 5 | Dependent |

Rating-style scales such as Participation, Tolerance, and Intensity use 1-5 ranges. Direction depends on the measurement: participation and tolerance usually improve upward, while intensity usually improves downward.

## Normalization Rules

Normalization is based on:

- stored metric type
- goal `targetValue`
- goal comparison direction
- inferred higher/lower-is-better direction when no comparison exists
- ordinal range when the measurement is score-like

Goal comparison takes priority:

- `GreaterThan`: higher raw values are better
- `LessThan`: lower raw values are better
- `Equal`: values closer to the target are better

When a goal has no target value or comparison, the scoring engine uses clinical text heuristics from target/goal labels. For example, aggression, elopement, latency, cue level, prompt level, assistance, and intensity are treated as lower-is-better. Accuracy, completion, fidelity, independence, tolerance, participation, requesting, and engagement are treated as higher-is-better.

This keeps existing saved notes compatible while avoiding the old assumption that every higher raw value is better.

## Signal Readiness

Signal colors should be based on normalized progress and trend, not raw values alone.

Future dashboard signal visuals should use:

`signalScore = normalizedScore adjusted by trend, consistency, and supportLevel`

The central client torus should use `clientSignalScore.normalizedTotalScore`, optionally adjusted visually by `trendDirection` and `confidence`.

Small progress can matter for clients with slow-moving data. Insight context now carries change fields such as `changeFromBaseline`, `changeFromPrevious`, `trendDirection`, `lowData`, and `clinicallySmallButPositiveChange` so future signals do not appear stagnant when a small improvement is clinically meaningful.

## Loading Priority

Template options never replace existing clinical data. The note-loading pipeline keeps this priority:

1. Active `GoalDefinition` items.
2. Current or carry-forward assessment items.
3. Previous session items.
4. Profession template options.

Targets are sorted by historical usage for the current provider when prior assessment items exist. Otherwise, targets use the default registry order.

## Supported Professions

### Behavior Therapist

Clinical rationale: ABA providers often collect data on skill acquisition, communication, adaptive routines, tolerance skills, and behavior reduction. Targets are phrased in ABA vocabulary and recommend the most common measurement type.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Manding | Percentage | Communication | Measures independent or prompted requesting. |
| Tacting | Percentage | Communication | Measures labeling accuracy. |
| Intraverbal | Percentage | Communication | Measures verbal responses without direct item correspondence. |
| Listener Responding | Percentage | Communication | Measures receptive response accuracy. |
| Receptive Language | Percentage | Communication | Measures understanding of directions or concepts. |
| Expressive Language | Percentage | Communication | Measures expressive communication accuracy. |
| Matching | Percentage | SkillAcquisition | Measures correct matching responses. |
| Imitation | Percentage | SkillAcquisition | Measures motor or vocal imitation accuracy. |
| Play Skills | Percentage | SkillAcquisition | Measures independent or prompted play responses. |
| Social Skills | Percentage | SkillAcquisition | Measures social response accuracy or participation. |
| Joint Attention | Percentage | SkillAcquisition | Measures coordinated attention responses. |
| Compliance | Percentage | SkillAcquisition | Measures instruction-following accuracy. |
| Transitioning | Duration | Adaptive | Measures time to transition or transition tolerance. |
| Toileting | Percentage | Adaptive | Measures independence or successful toileting steps. |
| Feeding | Percentage | Adaptive | Measures food acceptance or mealtime steps. |
| Aggression | Frequency | Behavior | Measures behavior count. |
| Elopement | Frequency | Behavior | Measures behavior count and safety risk. |
| Property Destruction | Frequency | Behavior | Measures behavior count. |
| Self Injury | Frequency | Behavior | Measures behavior count and safety risk. |
| Stereotypy | Frequency | Behavior | Measures behavior count. |
| Waiting | Duration | SkillAcquisition | Measures tolerance duration. |
| Turn Taking | Percentage | SkillAcquisition | Measures successful turn-taking opportunities. |
| Visual Schedule | Percentage | Adaptive | Measures independent schedule use. |
| Functional Communication | Percentage | Communication | Measures replacement communication responses. |

### Speech Pathologist

Clinical rationale: Speech-language providers measure speech production, receptive and expressive language, pragmatic language, AAC use, fluency, and voice.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Receptive Language | Percentage | Communication | Measures comprehension accuracy. |
| Expressive Language | Percentage | Communication | Measures expressive response accuracy. |
| Pragmatic Language | Subjective | Communication | Represents cue level and quality of social language. |
| Articulation | Percentage | Communication | Measures sound production accuracy. |
| Phonology | Percentage | Communication | Measures reduction of phonological processes. |
| Fluency | Frequency | Communication | Measures disfluency events or fluency strategy use. |
| Voice | Subjective | Communication | Captures vocal quality, intensity, or resonance. |
| AAC | Frequency | Communication | Counts functional AAC use. |
| Following Directions | Percentage | Communication | Measures receptive language accuracy. |
| WH Questions | Percentage | Communication | Measures response accuracy. |
| Labeling | Percentage | Communication | Measures expressive labeling accuracy. |
| Requesting | Frequency | Communication | Counts functional requests. |
| Conversation Skills | Subjective | Communication | Represents cue level and conversational quality. |
| Turn Taking | Frequency | Communication | Counts conversational or play turns. |
| Sentence Expansion | Percentage | Communication | Measures expanded utterance accuracy. |
| Social Communication | Subjective | Communication | Represents pragmatic quality and cueing. |

### Occupational Therapist

Clinical rationale: OT providers track participation, adaptive function, motor coordination, sensory regulation, ADLs, and assistance or independence levels.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Fine Motor | Subjective | Adaptive | Represents independence or assistance level for hand skills. |
| Gross Motor | Subjective | Adaptive | Represents quality and independence of movement. |
| Bilateral Coordination | Percentage | Adaptive | Measures successful coordinated attempts. |
| Visual Motor Integration | Percentage | Adaptive | Measures accuracy of visual-motor tasks. |
| Handwriting | Percentage | Adaptive | Measures legibility, formation, or task completion. |
| Sensory Regulation | Subjective | Regulation | Captures regulation state and strategy use. |
| ADLs | Subjective | Adaptive | Represents independence level in daily living. |
| Dressing | Subjective | Adaptive | Represents assistance level or independence. |
| Feeding | Subjective | Adaptive | Captures feeding participation and assistance. |
| Toileting | Subjective | Adaptive | Represents independence level. |
| Balance | Duration | Adaptive | Measures sustained balance or postural control. |
| Core Strength | Duration | Adaptive | Measures endurance in postural tasks. |
| Attention | Duration | Regulation | Measures sustained participation. |
| Executive Function | Subjective | Adaptive | Represents planning, sequencing, and support needs. |
| Body Awareness | Subjective | Adaptive | Captures proprioceptive and spatial awareness. |
| Motor Planning | Subjective | Adaptive | Represents praxis and assistance level. |

### Educator

Clinical rationale: Educators collect classroom performance and participation data across academic skills, routines, engagement, and peer interaction.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Reading | Percentage | SkillAcquisition | Measures accuracy. |
| Writing | Percentage | SkillAcquisition | Measures completion or accuracy. |
| Math | Percentage | SkillAcquisition | Measures accuracy. |
| Following Classroom Routine | Percentage | Adaptive | Measures routine completion. |
| Task Completion | Percentage | SkillAcquisition | Measures completion percentage. |
| Peer Interaction | Frequency | SkillAcquisition | Counts social initiations or responses. |
| Attention | Duration | Regulation | Measures sustained attention. |
| Academic Engagement | Duration | SkillAcquisition | Measures time engaged. |
| Transitioning | Duration | Adaptive | Measures transition time. |
| Homework Completion | Percentage | SkillAcquisition | Measures completed work. |
| Participation | Subjective | SkillAcquisition | Captures participation quality. |

### Caregiver

Clinical rationale: Caregiver notes focus on home observations rather than structured teaching trials. Targets emphasize routines, family context, safety, and daily patterns.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Sleep | Duration | Adaptive | Measures sleep duration or settling time. |
| Meals | Subjective | Adaptive | Captures mealtime quality and concerns. |
| Medication | Subjective | Adaptive | Captures home health observation. |
| Community Outings | Subjective | Adaptive | Captures generalization in community settings. |
| Play | Duration | SkillAcquisition | Measures play duration. |
| Communication | Frequency | Communication | Counts communication attempts. |
| Behavior at Home | Frequency | Behavior | Counts home behavior events. |
| Morning Routine | Subjective | Adaptive | Captures independence and routine quality. |
| Bedtime Routine | Subjective | Adaptive | Captures independence and settling. |
| Toileting | Frequency | Adaptive | Counts toileting events or attempts. |
| Family Interaction | Subjective | SkillAcquisition | Captures interaction quality. |
| Safety | Frequency | Behavior | Counts safety events or concerns. |

### Supervisor

Clinical rationale: Supervisor and BCBA notes capture higher-level clinical review, fidelity, staff coaching, caregiver training, generalization, and maintenance.

Targets:

| Target | Recommended metric | Domain | Rationale |
| --- | --- | --- | --- |
| Program Integrity | Percentage | SkillAcquisition | Measures program implementation accuracy. |
| Staff Performance | Subjective | Other | Captures coaching needs and implementation quality. |
| Generalization | Percentage | SkillAcquisition | Measures skill transfer across people/settings. |
| Maintenance | Percentage | SkillAcquisition | Measures retained mastered skills. |
| Prompt Fading | Subjective | SkillAcquisition | Captures progress toward independence. |
| Behavior Plan Fidelity | Percentage | Behavior | Measures fidelity to behavior plan steps. |
| Caregiver Training | Subjective | Other | Captures training participation and support level. |
| Clinical Observation | Subjective | Other | Captures high-level clinical impressions. |
| Goal Review | Subjective | Other | Captures goal progress and clinical decisions. |

## Adding A New Profession

1. Add the role to the shared role model if it does not already exist.
2. Add a new `ProfessionTargetOption[]` array in `app/libs/professionTemplates.ts`.
3. For each target, define:
   - `value`
   - `label`
   - `recommendedMetricType`
   - `defaultDomain`
   - optional `description`
   - optional `tags`
4. Register the target array in `professionTemplates`.
5. Do not add profession-specific React conditionals.
6. Run TypeScript, build, and lint.

Future professions should plug into the same generic note workflow by configuration only.
