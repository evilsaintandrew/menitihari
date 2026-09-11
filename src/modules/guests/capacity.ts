export const INVITED_PEOPLE_LIMIT = 500;
export const INVITED_PEOPLE_NEAR_LIMIT = 450;

export interface InvitedPeopleCapacity {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly isNearLimit: boolean;
}

export function getInvitedPeopleCapacity(used: number): InvitedPeopleCapacity {
  const safeUsed = Math.max(0, Math.trunc(used));
  return {
    used: safeUsed,
    limit: INVITED_PEOPLE_LIMIT,
    remaining: Math.max(0, INVITED_PEOPLE_LIMIT - safeUsed),
    isNearLimit: safeUsed >= INVITED_PEOPLE_NEAR_LIMIT,
  };
}

export function sumPartySizes(assignments: readonly { readonly maxPartySize: number }[]): number {
  return assignments.reduce((total, assignment) => total + assignment.maxPartySize, 0);
}
