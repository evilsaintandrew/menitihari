import type { Metadata } from "next";

import { VerifyEmailScreen } from "@/components/auth/verify-email-screen";

export const metadata: Metadata = {
  title: "Verifikasi email | Menitihari",
};

export default function VerifyEmailPage() {
  return <VerifyEmailScreen />;
}
