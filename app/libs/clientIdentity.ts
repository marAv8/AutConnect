export function clientDisplayCode(firstName: string, lastName: string) {
  const code = `${firstName.trim().slice(0, 2)}${lastName
    .trim()
    .slice(0, 2)}`;

  return code || "Client";
}

export function clientDisplayText(
  value: string,
  firstName: string,
  lastName: string
) {
  const displayCode = clientDisplayCode(firstName, lastName);
  const names = [
    `${firstName.trim()} ${lastName.trim()}`.trim(),
    firstName.trim(),
    lastName.trim(),
  ]
    .filter((name) => name.length > 2)
    .sort((first, second) => second.length - first.length);

  return names.reduce(
    (text, name) =>
      text.replace(
        new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"),
        displayCode
      ),
    value
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
