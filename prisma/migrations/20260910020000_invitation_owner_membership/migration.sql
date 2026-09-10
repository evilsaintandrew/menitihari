-- Move ownership to the membership relation before removing the legacy
-- invitations.owner_id source of truth.
INSERT INTO "invitation_members" ("invitation_id", "user_id", "role", "created_at", "updated_at")
SELECT invitation."id", invitation."owner_id", 'OWNER'::"InvitationRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "invitations" AS invitation
WHERE NOT EXISTS (
    SELECT 1
    FROM "invitation_members" AS member
    WHERE member."invitation_id" = invitation."id"
      AND member."role" = 'OWNER'::"InvitationRole"
)
ON CONFLICT ("invitation_id", "user_id") DO NOTHING;

-- Refuse to silently change ownership if legacy and membership data disagree.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "invitations" AS invitation
        JOIN "invitation_members" AS member
          ON member."invitation_id" = invitation."id"
         AND member."role" = 'OWNER'::"InvitationRole"
        WHERE member."user_id" <> invitation."owner_id"
    ) THEN
        RAISE EXCEPTION 'Invitation ownership data is inconsistent';
    END IF;
END;
$$;

-- At most one owner can be committed for an invitation.
CREATE UNIQUE INDEX "invitation_members_one_owner_idx"
    ON "invitation_members" ("invitation_id")
    WHERE "role" = 'OWNER'::"InvitationRole";

-- A committed invitation must retain one owner membership. The deferred
-- trigger permits a future ownership transfer in one transaction while
-- preventing a committed invitation from becoming ownerless. Cascading
-- membership deletion during invitation deletion is allowed.
CREATE OR REPLACE FUNCTION "enforce_invitation_owner_membership"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "invitations"
        WHERE "id" = OLD."invitation_id"
    ) THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' AND OLD."role" = 'OWNER'::"InvitationRole" THEN
        IF NOT EXISTS (
            SELECT 1
            FROM "invitation_members"
            WHERE "invitation_id" = OLD."invitation_id"
              AND "role" = 'OWNER'::"InvitationRole"
        ) THEN
            RAISE EXCEPTION 'Invitation must retain exactly one owner membership';
        END IF;
    ELSIF TG_OP = 'UPDATE'
      AND OLD."role" = 'OWNER'::"InvitationRole"
      AND OLD."role" <> NEW."role"
      AND NOT EXISTS (
          SELECT 1
          FROM "invitation_members"
          WHERE "invitation_id" = OLD."invitation_id"
            AND "role" = 'OWNER'::"InvitationRole"
      ) THEN
        RAISE EXCEPTION 'Invitation must retain exactly one owner membership';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "invitation_members_retain_owner_on_delete"
AFTER DELETE ON "invitation_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_invitation_owner_membership"();

CREATE CONSTRAINT TRIGGER "invitation_members_retain_owner_on_role_update"
AFTER UPDATE OF "role" ON "invitation_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_invitation_owner_membership"();

ALTER TABLE "invitations" DROP CONSTRAINT "invitations_owner_id_fkey";
DROP INDEX "invitations_owner_id_idx";
ALTER TABLE "invitations" DROP COLUMN "owner_id";

ALTER TABLE "invitation_members" DROP CONSTRAINT "invitation_members_user_id_fkey";
ALTER TABLE "invitation_members"
    ADD CONSTRAINT "invitation_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
