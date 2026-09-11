CREATE TYPE "GuestImportState" AS ENUM ('UPLOADED', 'PARSING', 'PREVIEW', 'COMMITTING', 'COMPLETED', 'FAILED');
CREATE TYPE "GuestImportRowState" AS ENUM ('INCLUDED', 'EXCLUDED', 'COMMITTED', 'FAILED');

CREATE TABLE "guest_imports" (
  "id" TEXT NOT NULL,
  "invitation_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "source_filename" TEXT NOT NULL,
  "source_mime_type" TEXT NOT NULL,
  "source_size_bytes" INTEGER NOT NULL,
  "source_bytes" BYTEA,
  "state" "GuestImportState" NOT NULL DEFAULT 'UPLOADED',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "valid_rows" INTEGER NOT NULL DEFAULT 0,
  "warning_rows" INTEGER NOT NULL DEFAULT 0,
  "invalid_rows" INTEGER NOT NULL DEFAULT 0,
  "included_rows" INTEGER NOT NULL DEFAULT 0,
  "committed_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "capacity_before" INTEGER NOT NULL DEFAULT 0,
  "capacity_additional" INTEGER NOT NULL DEFAULT 0,
  "capacity_after" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "status_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "guest_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guest_import_rows" (
  "id" TEXT NOT NULL,
  "guest_import_id" TEXT NOT NULL,
  "row_number" INTEGER NOT NULL,
  "display_name" TEXT,
  "phone" TEXT,
  "group_name" TEXT,
  "assignments" JSONB,
  "raw_values" JSONB NOT NULL,
  "issues" JSONB NOT NULL,
  "duplicate_warnings" JSONB NOT NULL,
  "is_valid" BOOLEAN NOT NULL DEFAULT false,
  "has_warnings" BOOLEAN NOT NULL DEFAULT false,
  "state" "GuestImportRowState" NOT NULL DEFAULT 'EXCLUDED',
  "guest_id" TEXT,
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "guest_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_imports_id_key" ON "guest_imports"("id");
CREATE INDEX "guest_imports_invitation_id_created_at_idx" ON "guest_imports"("invitation_id", "created_at");
CREATE INDEX "guest_imports_state_updated_at_idx" ON "guest_imports"("state", "updated_at");
CREATE UNIQUE INDEX "guest_import_rows_guest_import_id_row_number_key" ON "guest_import_rows"("guest_import_id", "row_number");
CREATE INDEX "guest_import_rows_guest_import_id_state_row_number_idx" ON "guest_import_rows"("guest_import_id", "state", "row_number");

ALTER TABLE "guest_imports"
  ADD CONSTRAINT "guest_imports_invitation_id_fkey"
  FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "guest_imports_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guest_import_rows"
  ADD CONSTRAINT "guest_import_rows_guest_import_id_fkey"
  FOREIGN KEY ("guest_import_id") REFERENCES "guest_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "guest_import_rows_guest_id_fkey"
  FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
