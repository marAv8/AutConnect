import { z } from "zod";

export const createClientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),

  dateOfBirth: z.string().optional(), // ISO string for now
  diagnosis: z.string().optional(),
  receivesPrescribedMedication: z.boolean().optional().default(false),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
