import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGuestManagementData } from "@/modules/guests";
import { prisma } from "@/server/db";

import { GuestsManager } from "./guests-manager";

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const data = await getGuestManagementData(prisma, session.user.id, id);
  if (!data) notFound();

  return <GuestsManager data={data} />;
}
