import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { InvitationDashboard } from "@/components/invitations/invitation-dashboard";
import { auth } from "@/lib/auth";
import { getInvitationDashboard } from "@/modules/invitations";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?next=/invitations");
  if (!session.user.emailVerified) redirect("/verify-email");

  const invitations = await getInvitationDashboard(prisma, session.user.id);
  return <InvitationDashboard invitations={invitations} />;
}
