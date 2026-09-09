import { DesignSystemShowcase } from "@/components/design-system-showcase";
import { ToastProvider } from "@/components/ui";

export default function HomePage() {
  return <ToastProvider><DesignSystemShowcase /></ToastProvider>;
}
