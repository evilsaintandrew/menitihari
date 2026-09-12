ALTER TABLE "guests"
  ADD COLUMN "whatsapp_first_opened_at" TIMESTAMPTZ(3),
  ADD COLUMN "whatsapp_last_opened_at" TIMESTAMPTZ(3),
  ADD COLUMN "whatsapp_opened_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "guests"
  ADD CONSTRAINT "guests_whatsapp_opened_count_nonnegative"
  CHECK ("whatsapp_opened_count" >= 0);
