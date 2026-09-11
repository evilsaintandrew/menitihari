ALTER TABLE "guests"
  ADD COLUMN "normalized_name" TEXT,
  ADD COLUMN "merged_into_guest_id" TEXT,
  ADD COLUMN "merged_at" TIMESTAMPTZ(3);

UPDATE "guests"
SET "normalized_name" = lower(regexp_replace(trim("display_name"), '[^[:alnum:]]+', ' ', 'g'));

UPDATE "guests"
SET "normalized_name" = regexp_replace("normalized_name", '\s+', ' ', 'g');

ALTER TABLE "guests"
  ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE INDEX "guests_invitation_id_normalized_name_idx"
  ON "guests"("invitation_id", "normalized_name");

ALTER TABLE "guests"
  ADD CONSTRAINT "guests_merged_into_guest_id_fkey"
  FOREIGN KEY ("merged_into_guest_id") REFERENCES "guests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
