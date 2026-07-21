/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, MetricType, AssessmentDomain, ComparisonType, Role } = require("@prisma/client");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const baseDate = new Date(Date.UTC(2026, 0, 5, 17, 0, 0));
const dayMs = 24 * 60 * 60 * 1000;

const providers = [
  { id: "synthetic-provider-bt", email: "synthetic.bt@autconnect.dev", firstName: "Julia", lastName: "Stone", role: Role.BehaviorTherapist },
  { id: "synthetic-provider-slp", email: "synthetic.slp@autconnect.dev", firstName: "Noah", lastName: "Patel", role: Role.SpeechPathologist },
  { id: "synthetic-provider-ot", email: "synthetic.ot@autconnect.dev", firstName: "Sofia", lastName: "Garcia", role: Role.OccupationalTherapist },
  { id: "synthetic-provider-educator", email: "synthetic.educator@autconnect.dev", firstName: "Avery", lastName: "Kim", role: Role.Educator },
  { id: "synthetic-provider-caregiver", email: "synthetic.caregiver@autconnect.dev", firstName: "Elena", lastName: "Rivera", role: Role.Caregiver },
  { id: "synthetic-provider-supervisor", email: "synthetic.supervisor@autconnect.dev", firstName: "Jordan", lastName: "Lee", role: Role.Supervisor },
];

const clients = [
  {
    id: "synthetic-client-daniel",
    firstName: "Daniel",
    lastName: "Hart",
    dateOfBirth: new Date(Date.UTC(2016, 3, 12)),
    diagnosis: "Synthetic Phase 5: high intelligence, relationship-sensitive, strong academics",
    story: "improves with trusted providers and regresses after classroom staffing changes",
  },
  {
    id: "synthetic-client-maya",
    firstName: "Maya",
    lastName: "Singh",
    dateOfBirth: new Date(Date.UTC(2018, 8, 3)),
    diagnosis: "Synthetic Phase 5: high support needs, prompt dependent, echolalia",
    story: "small milestone gains with slow normalized-score movement",
  },
  {
    id: "synthetic-client-sophia",
    firstName: "Sophia",
    lastName: "Nguyen",
    dateOfBirth: new Date(Date.UTC(2015, 10, 19)),
    diagnosis: "Synthetic Phase 5: high functioning, rigidity, self-injury and aggression",
    story: "excellent clinic acquisition with weak generalization at home and school",
  },
  {
    id: "synthetic-client-ethan",
    firstName: "Ethan",
    lastName: "Brooks",
    dateOfBirth: new Date(Date.UTC(2017, 1, 27)),
    diagnosis: "Synthetic Phase 5: highly verbal, adult-attention dependent",
    story: "strong one-to-one work with prompt fading and group-independence difficulty",
  },
];

const goalSpecs = {
  "synthetic-client-daniel": [
    goal("daniel-bt-intraverbal", "synthetic-provider-bt", "Intraverbal", "Answers peer questions with flexible language.", MetricType.Percentage, AssessmentDomain.Communication, 80, ComparisonType.GreaterThan, 1.2),
    goal("daniel-bt-waiting", "synthetic-provider-bt", "Waiting", "Waits during classroom transitions without refusal.", MetricType.Duration, AssessmentDomain.SkillAcquisition, 300, ComparisonType.GreaterThan, 0.9),
    goal("daniel-bt-refusal", "synthetic-provider-bt", "Task Refusal", "Frequency count during non-preferred adult demands.", MetricType.Frequency, AssessmentDomain.Behavior, 1, ComparisonType.LessThan, 1),
    goal("daniel-slp-conversation", "synthetic-provider-slp", "Conversation Skills", "Maintains reciprocal topic for three turns.", MetricType.Percentage, AssessmentDomain.Communication, 75, ComparisonType.GreaterThan, 1),
    goal("daniel-ot-regulation", "synthetic-provider-ot", "Sensory Regulation", "Uses regulation strategy before writing task.", MetricType.Subjective, AssessmentDomain.Regulation, 4, ComparisonType.GreaterThan, 0.8),
    goal("daniel-edu-routine", "synthetic-provider-educator", "Following Classroom Routine", "Completes independent academic routine after schedule change.", MetricType.Percentage, AssessmentDomain.Adaptive, 80, ComparisonType.GreaterThan, 1),
    goal("daniel-care-homework", "synthetic-provider-caregiver", "Homework Completion", "Completes homework without relationship repair cycle.", MetricType.Percentage, AssessmentDomain.SkillAcquisition, 80, ComparisonType.GreaterThan, 0.7),
    goal("daniel-sup-integrity", "synthetic-provider-supervisor", "Program Integrity", "Teacher team implements relationship-first transition plan.", MetricType.Percentage, AssessmentDomain.Other, 85, ComparisonType.GreaterThan, 1),
  ],
  "synthetic-client-maya": [
    goal("maya-bt-prompt", "synthetic-provider-bt", "Prompt Level", "Responds to one-step instruction with reduced prompt level.", MetricType.Subjective, AssessmentDomain.SkillAcquisition, 2, ComparisonType.LessThan, 1.2),
    goal("maya-bt-echolalia", "synthetic-provider-bt", "Echolalia", "Frequency count during structured communication.", MetricType.Frequency, AssessmentDomain.Communication, 4, ComparisonType.LessThan, 0.8),
    goal("maya-slp-aac", "synthetic-provider-slp", "AAC", "Uses AAC to request preferred item.", MetricType.Frequency, AssessmentDomain.Communication, 5, ComparisonType.GreaterThan, 1.1),
    goal("maya-slp-receptive", "synthetic-provider-slp", "Receptive Language", "Follows familiar one-step directions.", MetricType.Percentage, AssessmentDomain.Communication, 60, ComparisonType.GreaterThan, 1),
    goal("maya-ot-assist", "synthetic-provider-ot", "Assistance Level", "Completes feeding step with reduced assistance.", MetricType.Subjective, AssessmentDomain.Adaptive, 2, ComparisonType.LessThan, 1),
    goal("maya-edu-participation", "synthetic-provider-educator", "Participation", "Participates in circle routine with adult support.", MetricType.Subjective, AssessmentDomain.SkillAcquisition, 3, ComparisonType.GreaterThan, 0.7),
    goal("maya-care-morning", "synthetic-provider-caregiver", "Morning Routine", "Transitions through morning routine with visual support.", MetricType.Subjective, AssessmentDomain.Adaptive, 3, ComparisonType.GreaterThan, 0.7),
    goal("maya-sup-fidelity", "synthetic-provider-supervisor", "Fidelity", "Team uses wait time before repeating prompts.", MetricType.Percentage, AssessmentDomain.Other, 85, ComparisonType.GreaterThan, 1),
  ],
  "synthetic-client-sophia": [
    goal("sophia-bt-fct", "synthetic-provider-bt", "Functional Communication", "Requests break instead of escalation in clinic.", MetricType.Percentage, AssessmentDomain.Communication, 85, ComparisonType.GreaterThan, 1),
    goal("sophia-bt-self-injury", "synthetic-provider-bt", "Self Injury", "Frequency count during denied-access routines.", MetricType.Frequency, AssessmentDomain.Behavior, 1, ComparisonType.LessThan, 1.2),
    goal("sophia-slp-pragmatic", "synthetic-provider-slp", "Pragmatic Language", "Accepts conversational change without correction.", MetricType.Subjective, AssessmentDomain.Communication, 4, ComparisonType.GreaterThan, 0.8),
    goal("sophia-ot-flex", "synthetic-provider-ot", "Sensory Regulation", "Uses flexibility strategy before unexpected change.", MetricType.Subjective, AssessmentDomain.Regulation, 4, ComparisonType.GreaterThan, 1),
    goal("sophia-edu-rigidity", "synthetic-provider-educator", "Transitioning", "Transitions after schedule change without aggression.", MetricType.Duration, AssessmentDomain.Adaptive, 180, ComparisonType.LessThan, 1),
    goal("sophia-care-aggression", "synthetic-provider-caregiver", "Aggression", "Frequency count at home during routine changes.", MetricType.Frequency, AssessmentDomain.Behavior, 1, ComparisonType.LessThan, 1.1),
    goal("sophia-sup-fidelity", "synthetic-provider-supervisor", "Behavior Plan Fidelity", "Home and school teams implement response plan consistently.", MetricType.Percentage, AssessmentDomain.Behavior, 85, ComparisonType.GreaterThan, 1),
  ],
  "synthetic-client-ethan": [
    goal("ethan-bt-prompt-fading", "synthetic-provider-bt", "Prompt Fading", "Initiates task after group instruction with fewer adult prompts.", MetricType.Subjective, AssessmentDomain.SkillAcquisition, 2, ComparisonType.LessThan, 1.2),
    goal("ethan-bt-attention", "synthetic-provider-bt", "Attention", "Sustains independent work without adult attention.", MetricType.Duration, AssessmentDomain.Regulation, 600, ComparisonType.GreaterThan, 1),
    goal("ethan-slp-conversation", "synthetic-provider-slp", "Conversation Skills", "Maintains peer conversation without adult mediation.", MetricType.Subjective, AssessmentDomain.Communication, 4, ComparisonType.GreaterThan, 0.9),
    goal("ethan-ot-regulation", "synthetic-provider-ot", "Sensory Regulation", "Uses group-setting regulation strategy independently.", MetricType.Subjective, AssessmentDomain.Regulation, 4, ComparisonType.GreaterThan, 0.8),
    goal("ethan-edu-group", "synthetic-provider-educator", "Academic Engagement", "Maintains participation during group lesson.", MetricType.Duration, AssessmentDomain.SkillAcquisition, 900, ComparisonType.GreaterThan, 1),
    goal("ethan-care-routine", "synthetic-provider-caregiver", "Family Interaction", "Completes home routine without repeated adult attention.", MetricType.Subjective, AssessmentDomain.SkillAcquisition, 4, ComparisonType.GreaterThan, 0.7),
    goal("ethan-sup-fidelity", "synthetic-provider-supervisor", "Program Integrity", "Adults implement prompt fading before attention delivery.", MetricType.Percentage, AssessmentDomain.Other, 85, ComparisonType.GreaterThan, 1),
  ],
};

function goal(id, providerId, target, text, metricType, domain, targetValue, comparison, weight) {
  return {
    id: `synthetic-goal-${id}`,
    providerId,
    target,
    goal: text,
    metricType,
    domain,
    targetValue,
    comparison,
    weight,
    isActive: true,
    isMastered: false,
  };
}

function dateFor(day, roleIndex) {
  return new Date(baseDate.getTime() + day * dayMs + roleIndex * 60 * 60 * 1000);
}

function phase(day) {
  if (day < 30) return 0;
  if (day < 60) return 1;
  return 2;
}

function bounded(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function valueFor(clientId, target, metricType, day, providerRole) {
  const p = phase(day);
  const week = Math.floor(day / 7);

  if (clientId.includes("daniel")) {
    const staffingRegression = day >= 38 && day <= 52;
    if (target === "Task Refusal") return staffingRegression ? 5 - p : bounded(4 - p * 1.4 - week * 0.08, 0, 4);
    if (target === "Following Classroom Routine") return staffingRegression ? 52 + p * 4 : bounded(55 + week * 2.2, 45, 92);
    if (target === "Conversation Skills" || target === "Intraverbal") return bounded(58 + week * 2.4 - (staffingRegression ? 10 : 0), 45, 92);
    if (target === "Waiting") return bounded(120 + week * 22 - (staffingRegression ? 90 : 0), 60, 520);
    if (target === "Sensory Regulation") return staffingRegression ? 2 : bounded(2 + p, 1, 5);
    return bounded(58 + week * 2, 45, 95);
  }

  if (clientId.includes("maya")) {
    if (target === "Prompt Level" || target === "Assistance Level") return bounded(5 - p - (day > 72 ? 1 : 0), 2, 5);
    if (target === "AAC") return bounded(1 + p + (day > 70 ? 1 : 0), 1, 5);
    if (target === "Echolalia") return bounded(9 - p - (day > 70 ? 1 : 0), 5, 10);
    if (target === "Receptive Language") return bounded(28 + week * 1.4, 25, 55);
    if (target === "Participation" || target === "Morning Routine") return bounded(1 + p, 1, 3);
    return bounded(60 + week, 55, 82);
  }

  if (clientId.includes("sophia")) {
    const homeOrSchool = providerRole === Role.Caregiver || providerRole === Role.Educator;
    if (target === "Self Injury" || target === "Aggression") return homeOrSchool ? bounded(6 - p, 3, 7) : bounded(3 - p, 0, 3);
    if (target === "Transitioning") return bounded(homeOrSchool ? 420 - week * 9 : 210 - week * 12, 120, 480);
    if (target === "Functional Communication") return bounded(68 + week * 2.3, 65, 95);
    if (target === "Pragmatic Language" || target === "Sensory Regulation") return homeOrSchool ? 2 : bounded(2 + p, 2, 5);
    return bounded(homeOrSchool ? 55 + week : 72 + week * 1.8, 45, 95);
  }

  if (clientId.includes("ethan")) {
    const groupSetting = providerRole === Role.Educator;
    if (target === "Prompt Fading") return bounded(5 - p - (day > 75 ? 1 : 0), 1, 5);
    if (target === "Attention") return bounded(180 + week * 28, 160, 660);
    if (target === "Academic Engagement") return bounded(groupSetting ? 300 + week * 32 : 520 + week * 35, 240, 880);
    if (target === "Conversation Skills" || target === "Sensory Regulation" || target === "Family Interaction") return bounded(2 + p, 2, 5);
    return bounded(62 + week * 2, 50, 92);
  }

  return metricType === MetricType.Frequency ? 2 : metricType === MetricType.Duration ? 180 : metricType === MetricType.Subjective ? 3 : 70;
}

function itemFor(goalSpec, day, providerRole) {
  const value = valueFor(goalSpec.id, goalSpec.target, goalSpec.metricType, day, providerRole);
  return {
    goalId: goalSpec.id,
    target: goalSpec.target,
    goal: goalSpec.goal,
    metricType: goalSpec.metricType,
    domain: goalSpec.domain,
    rawValue: goalSpec.metricType === MetricType.Subjective ? null : value,
    score: goalSpec.metricType === MetricType.Subjective ? Math.round(value) : null,
    supportLevel: null,
  };
}

function normalize(item, goalSpec) {
  const raw = item.rawValue ?? item.score;
  if (raw === null || raw === undefined) return null;
  if (goalSpec.metricType === MetricType.Percentage) return bounded(raw / 100, 0, 1);
  if (goalSpec.metricType === MetricType.Subjective) {
    const lower = goalSpec.comparison === ComparisonType.LessThan;
    const max = lower ? 5 : 5;
    return lower ? bounded(1 - raw / max, 0, 1) : bounded(raw / max, 0, 1);
  }
  if (goalSpec.comparison === ComparisonType.LessThan) return bounded(goalSpec.targetValue / Math.max(raw, 1), 0, 1);
  if (goalSpec.comparison === ComparisonType.GreaterThan) return bounded(raw / goalSpec.targetValue, 0, 1);
  return null;
}

function finalScore(items, goalsById) {
  let weighted = 0;
  let total = 0;
  for (const item of items) {
    const goalSpec = goalsById.get(item.goalId);
    const success = goalSpec ? normalize(item, goalSpec) : null;
    if (success === null) continue;
    weighted += success * (goalSpec.weight ?? 1);
    total += goalSpec.weight ?? 1;
  }
  return total === 0 ? null : bounded(Math.round((weighted / total) * 10), 1, 10);
}

function noteFor(client, providerRole, day, items) {
  const p = phase(day);
  const abc = abcLine(client.id, providerRole, day);
  const milestones = [];
  if (client.id.includes("maya") && day === 70) milestones.push("Milestone: Maya independently activated AAC after a 5-second wait.");
  if (client.id.includes("daniel") && day === 42) milestones.push("Environment change: classroom aide changed; trust repair was needed before academic demand.");
  if (client.id.includes("sophia") && day === 49) milestones.push("Generalization failure: clinic strategy did not carry over during home routine change.");
  if (client.id.includes("ethan") && day === 63) milestones.push("Prompt fading: adult waited before providing attention; Ethan re-engaged after peer cue.");
  const targets = items.map((item) => item.target).join(", ");
  return [
    `${client.firstName} session (${providerRole}) targeting ${targets}. ${client.story}. Phase ${p + 1} data entered with deterministic clinical trajectory.`,
    ...milestones,
    abc,
  ].filter(Boolean).join("\n");
}

function abcLine(clientId, providerRole, day) {
  if (providerRole !== Role.BehaviorTherapist && providerRole !== Role.Caregiver && providerRole !== Role.Educator) return "";
  if (day % 21 !== 0 && !(clientId.includes("ethan") && day % 14 === 0)) return "";

  if (clientId.includes("ethan")) {
    return "ABC: Antecedent=group direction delivered without immediate adult attention | Behavior=called out and waited for adult response | Consequence=adult delayed prompt, peer model provided, Ethan returned to group task.";
  }
  if (clientId.includes("sophia")) {
    return "ABC: Antecedent=unexpected routine change | Behavior=self-injury/aggression attempt | Consequence=blocked for safety, break request prompted, plan reviewed for home-school consistency.";
  }
  if (clientId.includes("daniel")) {
    return "ABC: Antecedent=non-preferred demand from less-trusted staff | Behavior=task refusal and debate | Consequence=relationship repair, choice offered, demand represented.";
  }
  return "ABC: Antecedent=repeated instruction without wait time | Behavior=echolalia and prompt dependence | Consequence=team paused, modeled AAC, reinforced independent activation.";
}

function sessionPlan(client) {
  const byProvider = new Map(goalSpecs[client.id].map((goalSpec) => [goalSpec.providerId, []]));
  for (const goalSpec of goalSpecs[client.id]) {
    byProvider.get(goalSpec.providerId).push(goalSpec);
  }
  const roleDays = [
    ["synthetic-provider-bt", Role.BehaviorTherapist, [0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35, 42, 46, 49, 53, 56, 60, 63, 67, 70, 74, 77, 81, 84]],
    ["synthetic-provider-slp", Role.SpeechPathologist, [1, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85]],
    ["synthetic-provider-ot", Role.OccupationalTherapist, [2, 9, 23, 30, 44, 51, 65, 72, 86]],
    ["synthetic-provider-educator", Role.Educator, [3, 10, 17, 24, 31, 38, 52, 59, 66, 73, 80, 87]],
    ["synthetic-provider-caregiver", Role.Caregiver, [5, 12, 19, 26, 33, 40, 47, 61, 68, 75, 82, 89]],
    ["synthetic-provider-supervisor", Role.Supervisor, [6, 20, 34, 48, 62, 76]],
  ];
  const entries = [];
  for (const [providerId, role, days] of roleDays) {
    const providerGoals = byProvider.get(providerId) ?? [];
    for (const day of days) {
      if ((client.id.includes("daniel") && role === Role.Educator && day === 45) || (client.id.includes("maya") && role === Role.OccupationalTherapist && day === 44)) {
        continue;
      }
      const items = providerGoals.slice(0, role === Role.Supervisor ? 1 : 2).map((goalSpec) => itemFor(goalSpec, day, role));
      const goalsById = new Map(goalSpecs[client.id].map((goalSpec) => [goalSpec.id, goalSpec]));
      entries.push({
        providerId,
        clientId: client.id,
        date: dateFor(day, providers.findIndex((provider) => provider.id === providerId)),
        note: noteFor(client, role, day, items),
        finalScore: finalScore(items, goalsById),
        items,
      });
    }
  }
  return entries;
}

function buildDataset() {
  const entries = clients.flatMap(sessionPlan);
  const assessmentItemCount = entries.reduce((sum, entry) => sum + entry.items.length, 0);
  const abcEventCount = entries.filter((entry) => entry.note.includes("ABC:")).length;
  return { entries, assessmentItemCount, abcEventCount };
}

async function resetSyntheticClients() {
  const clientIds = clients.map((client) => client.id);
  const providerIds = providers.map((provider) => provider.id);
  await prisma.entryRead.deleteMany({ where: { entry: { clientId: { in: clientIds } } } });
  await prisma.assessmentItem.deleteMany({ where: { entry: { clientId: { in: clientIds } } } });
  await prisma.entry.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.goalDefinition.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.providerClient.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.providerClient.deleteMany({ where: { providerId: { in: providerIds }, clientId: { in: clientIds } } });
}

async function main() {
  const dataset = buildDataset();
  const expected = {
    clients: clients.length,
    providers: providers.length,
    sessions: dataset.entries.length,
    assessmentItems: dataset.assessmentItemCount,
    abcEventsInNotes: dataset.abcEventCount,
  };

  if (dryRun) {
    console.log(JSON.stringify(expected, null, 2));
    return;
  }

  await resetSyntheticClients();

  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { email: provider.email },
      update: {
        firstName: provider.firstName,
        lastName: provider.lastName,
        role: provider.role,
        providerRole: provider.role,
      },
      create: {
        id: provider.id,
        email: provider.email,
        firstName: provider.firstName,
        lastName: provider.lastName,
        role: provider.role,
        providerRole: provider.role,
        authType: "email",
      },
    });
  }

  for (const client of clients) {
    await prisma.client.create({
      data: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dateOfBirth: client.dateOfBirth,
        diagnosis: client.diagnosis,
      },
    });

    for (const provider of providers) {
      await prisma.providerClient.create({
        data: {
          providerId: provider.id,
          clientId: client.id,
          role: provider.role,
        },
      });
    }

    for (const goalSpec of goalSpecs[client.id]) {
      await prisma.goalDefinition.create({
        data: {
          id: goalSpec.id,
          clientId: client.id,
          providerId: goalSpec.providerId,
          target: goalSpec.target,
          goal: goalSpec.goal,
          metricType: goalSpec.metricType,
          domain: goalSpec.domain,
          targetValue: goalSpec.targetValue,
          comparison: goalSpec.comparison,
          weight: goalSpec.weight,
          isActive: goalSpec.isActive,
          isMastered: goalSpec.isMastered,
        },
      });
    }
  }

  for (const entry of dataset.entries) {
    await prisma.entry.create({
      data: {
        providerId: entry.providerId,
        clientId: entry.clientId,
        date: entry.date,
        note: entry.note,
        finalScore: entry.finalScore,
        items: {
          create: entry.items,
        },
      },
    });
  }

  console.log(JSON.stringify(expected, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
