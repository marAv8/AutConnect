export function parsePlatformAdminEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPlatformAdminEmail(
  email: string,
  configuredEmails = process.env.AUTCONNECT_PLATFORM_ADMIN_EMAILS
) {
  return parsePlatformAdminEmails(configuredEmails).has(email.trim().toLowerCase());
}

