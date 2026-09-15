"use server";

import { db } from "@/lib/db";
import { requireCurrentSupervisor } from "@/lib/authorization";
import {
  createFieldObservationRecord,
  getFieldObservationsForClient,
  type CreateFieldObservationInput,
} from "@/lib/fieldObservationPersistence";

export async function createFieldObservation(
  input: CreateFieldObservationInput,
) {
  const supervisor = await requireCurrentSupervisor();
  return createFieldObservationRecord(db, supervisor.id, input);
}

export async function getFieldObservations(clientId: string) {
  const supervisor = await requireCurrentSupervisor();
  return getFieldObservationsForClient(db, supervisor.id, clientId);
}
