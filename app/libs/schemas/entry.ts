import { z } from "zod";
import { AssessmentDomain, EntryKind, EntryVisibility, MetricType } from "@prisma/client";

export const assessmentItemSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  target: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  score: z.number().int().min(1).max(10).nullable().optional(),
  metricType: z.nativeEnum(MetricType),
  domain: z.nativeEnum(AssessmentDomain).nullable().optional(),
  rawValue: z.number().finite().nullable().optional(),
  supportLevel: z.number().int().min(1).max(10).nullable().optional(),
  observation: z.string().trim().max(4000).nullable().optional(),
});

export const createEntrySchema = z.object({
  clientId: z.string().uuid(),
  kind: z.nativeEnum(EntryKind).optional().default(EntryKind.SessionNote),
  visibility: z.nativeEnum(EntryVisibility).optional().default(EntryVisibility.Shared),
  note: z.string().trim().optional().transform((value) => value ?? ""),
  items: z.array(assessmentItemSchema),
}).superRefine((value, ctx) => {
  if (
    value.kind === EntryKind.SessionNote &&
    value.note.length === 0 &&
    value.items.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one assessment item is required.",
      path: ["items"],
    });
  }
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type AssessmentItemInput = z.infer<typeof assessmentItemSchema>;
