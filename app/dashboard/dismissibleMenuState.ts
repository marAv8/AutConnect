export type DismissibleMenuState = { current: boolean };

export function openDismissibleMenu(
  state: DismissibleMenuState,
  onChange: (open: boolean) => void
) {
  if (state.current) return false;
  state.current = true;
  onChange(true);
  return true;
}

export function closeDismissibleMenu(
  state: DismissibleMenuState,
  onChange: (open: boolean) => void
) {
  if (!state.current) return false;
  state.current = false;
  onChange(false);
  return true;
}

export function toggleDismissibleMenu(
  state: DismissibleMenuState,
  onChange: (open: boolean) => void
) {
  return state.current
    ? closeDismissibleMenu(state, onChange)
    : openDismissibleMenu(state, onChange);
}

export function runDismissibleMenuAction(
  state: DismissibleMenuState,
  onChange: (open: boolean) => void,
  action: () => void
) {
  if (!closeDismissibleMenu(state, onChange)) return false;
  action();
  return true;
}
