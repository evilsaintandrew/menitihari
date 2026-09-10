import { DesignSystemShowcase } from "@/components/design-system-showcase";
import { TextLink, ToastProvider } from "@/components/ui";

export default function HomePage() {
  return <ToastProvider><div className="auth-demo-nav"><TextLink href="/signup">Buat akun</TextLink><TextLink href="/login">Masuk</TextLink></div><DesignSystemShowcase /></ToastProvider>;
}
