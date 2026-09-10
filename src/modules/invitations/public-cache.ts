/**
 * Public invitation reads should use this stable tag when they opt into
 * Next.js caching. The invitation id remains stable even when a later ticket
 * changes the canonical slug.
 */
export function publicInvitationCacheTag(invitationId: string): string {
  return `public-invitation:${invitationId}`;
}
