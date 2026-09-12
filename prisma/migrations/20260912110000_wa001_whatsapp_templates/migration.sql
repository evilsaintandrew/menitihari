CREATE TYPE "WhatsAppTemplateType" AS ENUM ('INVITATION', 'RSVP_REMINDER', 'EVENT_REMINDER');

CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "type" "WhatsAppTemplateType" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_templates_invitation_id_type_key"
    ON "whatsapp_templates"("invitation_id", "type");
CREATE INDEX "whatsapp_templates_invitation_id_idx"
    ON "whatsapp_templates"("invitation_id");

ALTER TABLE "whatsapp_templates"
  ADD CONSTRAINT "whatsapp_templates_invitation_id_fkey"
  FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "whatsapp_templates" ("id", "invitation_id", "type", "body", "created_at", "updated_at")
SELECT
  'whatsapp-template-' || i."id" || '-INVITATION',
  i."id",
  'INVITATION'::"WhatsAppTemplateType",
  'Kepada {guest_name}, kami mengundang Anda ke pernikahan {couple_name}. Lihat undangan: {invitation_url}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invitations" AS i;

INSERT INTO "whatsapp_templates" ("id", "invitation_id", "type", "body", "created_at", "updated_at")
SELECT
  'whatsapp-template-' || i."id" || '-RSVP_REMINDER',
  i."id",
  'RSVP_REMINDER'::"WhatsAppTemplateType",
  'Halo {guest_name}, mohon konfirmasi kehadiran Anda di undangan {couple_name}: {invitation_url}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invitations" AS i;

INSERT INTO "whatsapp_templates" ("id", "invitation_id", "type", "body", "created_at", "updated_at")
SELECT
  'whatsapp-template-' || i."id" || '-EVENT_REMINDER',
  i."id",
  'EVENT_REMINDER'::"WhatsAppTemplateType",
  'Halo {guest_name}, jangan lupa menghadiri {event_name} pada {event_date} pukul {event_time} di {event_venue}. Lihat detail: {invitation_url}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invitations" AS i;
