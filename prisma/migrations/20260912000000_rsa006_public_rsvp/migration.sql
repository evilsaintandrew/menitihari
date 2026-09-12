ALTER TABLE "invitations"
  ADD COLUMN "public_rsvp_require_phone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_rsvp_max_party_size" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_public_rsvp_max_party_size_check"
  CHECK ("public_rsvp_max_party_size" BETWEEN 1 AND 500);

ALTER TABLE "events"
  ADD COLUMN "public_rsvp_enabled" BOOLEAN NOT NULL DEFAULT false;
