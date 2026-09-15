import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

test("invited agency owner creates an account and first client", async ({
  page,
}, testInfo) => {
  const db = new PrismaClient();
  const runId = `${testInfo.project.name.replace(/\W+/g, "-")}-${randomUUID().slice(0, 8)}`;
  const organizationName = `AutConnect E2E ${runId}`;
  const normalizedOrganizationName = organizationName.toLowerCase();
  const email = `e2e.supervisor.${runId}@autconnect.test`;
  const password = `E2e-${randomBytes(12).toString("base64url")}!`;
  const invitationToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(invitationToken).digest("hex");
  const clientFirstName = "E2E";
  const clientLastName = runId.slice(-8);

  let organizationId: string | null = null;

  try {
    const platformAdminEmail = process.env.AUTCONNECT_PLATFORM_ADMIN_EMAILS
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .find(Boolean);

    if (!platformAdminEmail) {
      throw new Error(
        "AUTCONNECT_PLATFORM_ADMIN_EMAILS must identify the local test approver."
      );
    }

    const platformAdmin = await db.provider.findFirst({
      where: {
        email: { equals: platformAdminEmail, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!platformAdmin) {
      throw new Error("The configured local platform administrator was not found.");
    }

    const organization = await db.organization.create({
      data: {
        name: organizationName,
        normalizedName: normalizedOrganizationName,
        type: "AGENCY",
        invitations: {
          create: {
            email,
            normalizedEmail: email,
            providerRole: "Supervisor",
            membershipRole: "OWNER",
            tokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            invitedByProviderId: platformAdmin.id,
          },
        },
      },
      select: { id: true },
    });
    organizationId = organization.id;

    await page.goto(`/create-account?invite=${encodeURIComponent(invitationToken)}`);
    await expect(
      page.getByText(`Invitation to ${organizationName} as Supervisor.`)
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(
      page.locator('input[readonly][value="Supervisor"]'),
    ).toHaveValue("Supervisor");

    await page.locator("#firstName").fill("E2E");
    await page.locator("#lastName").fill("Supervisor");
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL(/\/portal\/supervisor\/create-first-client$/);
    await expect(
      page.getByRole("link", { name: "Create Your First Client" })
    ).toBeVisible();

    await page.getByRole("link", { name: "Create Your First Client" }).click();
    await expect(page).toHaveURL(/\/portal\/supervisor\/create-client$/);
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Client full name").fill(
      `${clientFirstName} ${clientLastName}`
    );
    await page
      .locator('select[name="organizationId"]')
      .selectOption({ label: `${organizationName} — Agency` });
    await expect(page.locator('input[name="fullName"]')).toHaveValue(
      `${clientFirstName} ${clientLastName}`
    );
    await expect(page.locator('select[name="organizationId"]')).toHaveValue(
      organization.id
    );
    await Promise.all([
      page.waitForURL(/\/dashboard$/, { timeout: 20_000 }),
      page.getByRole("button", { name: "Create Client" }).click(),
    ]);
    await expect(
      page.getByText(`${clientFirstName.slice(0, 2)}${clientLastName.slice(0, 2)}`, {
        exact: true,
      })
    ).toBeVisible();

    const createdProvider = await db.provider.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        organizationMemberships: {
          where: { organizationId: organization.id },
          select: { role: true, active: true },
        },
        providerClients: {
          where: { organizationId: organization.id },
          select: {
            role: true,
            client: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    expect(createdProvider).toMatchObject({
      role: "Supervisor",
      organizationMemberships: [{ role: "OWNER", active: true }],
      providerClients: [
        {
          role: "Supervisor",
          client: { firstName: clientFirstName, lastName: clientLastName },
        },
      ],
    });

    const acceptedInvitation = await db.organizationInvitation.findUnique({
      where: { tokenHash },
      select: { acceptedAt: true, revokedAt: true },
    });
    expect(acceptedInvitation?.acceptedAt).not.toBeNull();
    expect(acceptedInvitation?.revokedAt).toBeNull();
  } finally {
    const provider = await db.provider.findUnique({
      where: { email },
      select: {
        id: true,
        providerClients: {
          select: { clientId: true },
        },
      },
    });
    const clientIds = provider?.providerClients.map(({ clientId }) => clientId) ?? [];

    if (clientIds.length > 0) {
      await db.providerClient.deleteMany({ where: { clientId: { in: clientIds } } });
      await db.client.deleteMany({ where: { id: { in: clientIds } } });
    }

    if (provider) {
      await db.organizationMembership.deleteMany({ where: { providerId: provider.id } });
      await db.provider.delete({ where: { id: provider.id } });
    }

    if (organizationId) {
      await db.organization.deleteMany({ where: { id: organizationId } });
    }

    await db.$disconnect();
  }
});
