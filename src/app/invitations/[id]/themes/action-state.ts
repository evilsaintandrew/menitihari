export interface ThemeSelectionActionState {
  readonly ok: boolean;
  readonly selectedThemeId?: string;
  readonly message?: string;
  readonly formError?: string;
}

export const initialThemeSelectionActionState: ThemeSelectionActionState = { ok: false };
