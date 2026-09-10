-- Every invitation must have exactly one current canonical slug. Historical
-- aliases remain unique and are never deleted or reused.
CREATE UNIQUE INDEX "invitation_slugs_one_canonical_per_invitation_idx"
    ON "invitation_slugs" ("invitation_id")
    WHERE "is_canonical" = true;

-- INV-001 did not yet allocate slugs. Give existing invitations the same
-- deterministic name-based path used by new invitations, with the invitation
-- id as a collision-safe fallback for legacy data.
DO $$
DECLARE
    invitation_record RECORD;
    base_slug TEXT;
    candidate_slug TEXT;
    suffix INTEGER;
BEGIN
    FOR invitation_record IN
        SELECT i."id", i."couple_display_name_1", i."couple_display_name_2"
        FROM "invitations" AS i
        WHERE NOT EXISTS (
            SELECT 1 FROM "invitation_slugs" AS s
            WHERE s."invitation_id" = i."id"
        )
    LOOP
        base_slug := lower(trim(both '-' FROM regexp_replace(
            invitation_record."couple_display_name_1" || '-' || invitation_record."couple_display_name_2",
            '[^a-zA-Z0-9]+', '-', 'g'
        )));
        IF base_slug = '' THEN
            base_slug := 'undangan';
        END IF;
        base_slug := left(base_slug, 80);
        candidate_slug := base_slug;
        suffix := 1;

        WHILE EXISTS (SELECT 1 FROM "invitation_slugs" WHERE "slug" = candidate_slug) LOOP
            suffix := suffix + 1;
            candidate_slug := left(base_slug, 80 - length(suffix::TEXT) - 1) || '-' || suffix::TEXT;
        END LOOP;

        INSERT INTO "invitation_slugs" ("id", "invitation_id", "slug", "is_canonical", "created_at", "updated_at")
        VALUES ('legacy-' || invitation_record."id", invitation_record."id", candidate_slug, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END LOOP;
END $$;
