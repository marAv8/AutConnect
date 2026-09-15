"use server";

export async function createClient(input: unknown): Promise<never> {
  void input;
  throw new Error(
    "This legacy action is unavailable. Use the authenticated Client creation workflow."
  );
}
