import { buildClientDayContext } from "./clientDayBuilder";
import { generateClientDailyHandoff } from "./clientDailyHandoff";
import type { ClientDailyHandoff } from "./types";

export async function buildClientDailyHandoff(input: {
  clientId: string;
  date: Date | string;
  viewerProviderId?: string;
  viewerRole?: string;
  currentDate?: Date | string;
}): Promise<ClientDailyHandoff | null> {
  const context = await buildClientDayContext(input);
  return context ? generateClientDailyHandoff(context) : null;
}
