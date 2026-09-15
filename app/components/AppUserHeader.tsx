import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";

export default async function AppUserHeader() {
  const session = await getSession();
  if (!session) return null;

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: {
      firstName: true,
      lastName: true,
      role: true,
    },
  });
  if (!provider) return null;
  const displayName = formatProviderDisplayName(
    provider.firstName,
    provider.lastName
  );

  return (
    <AuthenticatedPageHeader
      displayName={displayName}
      role={provider.role}
    />
  );
}
