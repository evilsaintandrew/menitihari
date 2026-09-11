import type { InvitationRenderData } from "@/modules/invitations";
import { resolveThemeForRender } from "@/modules/themes";

import { InvitationThemeView } from "./invitation-theme-view";
import { ThemeErrorBoundary } from "./theme-error-boundary";

export function InvitationRenderer({ invitation }: { readonly invitation: InvitationRenderData }) {
  const theme = resolveThemeForRender(
    invitation.themeId,
    invitation.themeVersion,
    invitation.themeConfig,
  );

  return (
    <ThemeErrorBoundary themeName={theme.definition.name}>
      <InvitationThemeView invitation={invitation} theme={theme} />
    </ThemeErrorBoundary>
  );
}
