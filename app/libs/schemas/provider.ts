import { z } from "zod";

export const providerRoleEnum = z.enum([
  "Supervisor",
  "Educator",
  "SpeechPathologist",
  "Caregiver",
  "BehaviorTherapist",
  "OccupationalTherapist",
]);

export const createProviderSchema = z.object({
  email: z.string().email(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),

  firstName: z
    .string()
    .min(1, "First name is required"),

  lastName: z
    .string()
    .min(1, "Last name is required"),

  role: providerRoleEnum,
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
