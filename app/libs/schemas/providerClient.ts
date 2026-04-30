import { z } from "zod";

export const assignProviderToClientSchema = z.object({
  providerId: z.string().uuid(),
  clientId: z.string().uuid(),

  role: z.enum([
    "Supervisor",
    "Educator",
    "SpeechPathologist",
    "Caregiver",
    "BehaviorTherapist",
    "OccupationalTherapist",
  ]),
});

export type AssignProviderToClientInput =
  z.infer<typeof assignProviderToClientSchema>;
