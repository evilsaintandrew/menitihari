import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGuestImportForOwner } from "@/modules/guests";
import { prisma } from "@/server/db";

import { GuestImportManager } from "../guest-import-manager";

export default async function GuestImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ importId?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const { importId } = await searchParams;
  const guestImport = await getGuestImportForOwner(prisma, session.user.id, id, importId);
  if (importId && !guestImport) notFound();
  return <GuestImportManager guestImport={guestImport} invitationId={id} />;
}
