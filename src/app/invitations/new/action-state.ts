export type InvitationField = "coupleDisplayName1" | "coupleDisplayName2" | "mainEventDate";

export interface CreateInvitationActionState {
  readonly ok: boolean;
  readonly invitationId?: string;
  readonly fieldErrors?: Partial<Record<InvitationField, string>>;
  readonly formError?: string;
}

export const initialCreateInvitationActionState: CreateInvitationActionState = { ok: false };
