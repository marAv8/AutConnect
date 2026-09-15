export function applySuccessfulClientRemoval<T extends { id: string }>(
  clients: readonly T[],
  activeClientId: string | undefined,
  removedClientId: string
) {
  const remainingClients = clients.filter(
    (client) => client.id !== removedClientId
  );

  return {
    remainingClients,
    activeClientId:
      activeClientId === removedClientId
        ? remainingClients[0]?.id
        : activeClientId,
  };
}
