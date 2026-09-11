import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getInvitationEventEditorData } from "@/modules/events";
import { prisma } from "@/server/db";

import { EventsManager } from "./events-manager";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const data = await getInvitationEventEditorData(prisma, session.user.id, id);
  if (!data) notFound();

  return <EventsManager data={data} />;
}
