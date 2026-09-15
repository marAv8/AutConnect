/**
 * Moves the client orbit from its action-menu layer to its completion-dialog
 * layer without allowing both to remain interactive at the same time.
 */
export function transitionToSessionCompletionConfirmation(
  providerId: string,
  commitMenuUnmount: () => void,
  mountConfirmation: (providerId: string) => void
) {
  commitMenuUnmount();
  mountConfirmation(providerId);
}
