CREATE TABLE "whatsapp_trial_contact_usages" (
    "invitation_id" TEXT NOT NULL,
    "contact_digest" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_trial_contact_usages_pkey" PRIMARY KEY ("invitation_id", "contact_digest")
);

ALTER TABLE "whatsapp_trial_contact_usages"
  ADD CONSTRAINT "whatsapp_trial_contact_usages_invitation_id_fkey"
  FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
