import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NewInvitationCard } from "@/components/invitations/new-invitation-form";
import { TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Undangan baru | Menitihari",
};

export default async function NewInvitationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?next=/invitations/new");
  if (!session.user.emailVerified) redirect("/verify-email");

  return (
    <main className="auth-page invitation-create-page">
      <div className="auth-container invitation-create-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <NewInvitationCard />
      </div>
    </main>
  );
}
