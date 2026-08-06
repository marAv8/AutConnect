# Synthetic signal-calibration fixtures

These fixtures are isolated test data. They do not connect to Prisma or mutate a
database unless a separate, explicit importer is added and invoked later.

## SuDo signal lab

`sudoTimeline.js` converts the user-reviewed SuDo narrative into a deterministic
chronology covering January through October 2025. It includes:

- provider-specific entries and measurements;
- stable caregiver context during school difficulties;
- realistic provider cadence and sparse missing documentation;
- A-B-C observations, including the bounded Special Olympics event;
- the September-October service-coordination breakdown and resolution records;
- reusable goal definitions; and
- a separate expected-signal track for evaluating a future signal engine.

The source records never contain the expected color. This avoids circular tests
where the generated input reveals the answer the signal engine should infer.

Run the deterministic checks:

```sh
npm run synthetic:sudo:test
```

Preview counts and selected anchor dates:

```sh
npm run synthetic:sudo:preview
```

Print the complete in-memory fixture as JSON without writing it:

```sh
node prisma/preview-sudo-timeline.js --json
```

Preview the guarded database import by mapping provider roles from the real
source client. Preview mode is the default and does not write:

```sh
npm run synthetic:sudo:import -- --source-client-id=<client-id>
```

The importer creates a separate `Suren Signal Lab` client, refuses to overwrite
an existing fixture, uses a transaction, and requires the explicit `--write`
flag before inserting anything.

Replay the transparent first-pass signal evaluator and compare its output with
the separately reviewed timeline:

```sh
npm run synthetic:sudo:replay
```

The evaluator processes records in date order, retains only prior measurements
as its rolling comparison history, and never receives the expected label as an
input feature. Use `-- --details` to print every mismatch for review.

After importing, verify the identical replay through persisted PostgreSQL rows:

```sh
npm run synthetic:sudo:replay:db
```

When a reviewed fixture changes after its initial import, refresh only that
synthetic client's generated entries with both explicit guards:

```sh
npm run synthetic:sudo:import -- --source-client-id=<client-id> --write --refresh-entries
```

The refresh refuses to run if the Signal Lab client contains any non-fixture
entry or goal.

## Maye signal lab

`mayeTimeline.js` is an eight-week, baseline-relative calibration case. It
deliberately treats Maye's established high prompting, echolalia, pacing, and
motor-planning needs as neutral baseline data. Signals instead reflect change:

- amber for prolonged transition latency/refusal or an active placement review;
- red only for a predefined critical safety event;
- blue for sustained, cross-setting improvement from Maye's own baseline; and
- neutral for expected variability at her individualized support level.

Preview and replay without database writes:

```sh
npm run synthetic:maye:preview
npm run synthetic:maye:replay
```

The guarded importer copies provider-role assignments from the real source
client into a separate `Maye Signal Lab` client. Preview is the default; the
explicit `--write` flag is required:

```sh
npm run synthetic:maye:import -- --source-client-id=<client-id>
npm run synthetic:maye:import -- --source-client-id=<client-id> --write
npm run synthetic:maye:replay:db
```

## Functional-communication/DTT signal lab

`fctTimeline.js` models a stable, nonspeaking young child with high daily-living
support needs, a physical disability, and a DTT-heavy program. Frequent
prompted acquisition remains neutral. Blue is limited to a newly independent
functional-communication response or meaningful generalization, including
pointing, picture selection, independently accessing the system, requesting a
break, communicating at home, or communicating with a new partner.

The fixture is intentionally mostly neutral: 31 neutral, 6 blue, 2 amber, and
1 artificial red safety stress-test day across eight weeks. The red event is
not part of the user-narrated history.

```sh
npm run synthetic:fct:preview
npm run synthetic:fct:replay
npm run synthetic:fct:import -- --source-client-id=<client-id>
npm run synthetic:fct:import -- --source-client-id=<client-id> --write
npm run synthetic:fct:replay:db
```
