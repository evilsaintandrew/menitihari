-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountDeletionState" AS ENUM ('ACTIVE', 'DELETION_COOLING_OFF', 'DELETION_COMMITTED', 'PURGED');

-- CreateEnum
CREATE TYPE "InvitationRole" AS ENUM ('OWNER');

-- CreateEnum
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "CommercialState" AS ENUM ('TRIAL', 'TRIAL_EXPIRED', 'PAID_ACTIVE', 'GRACE', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('GENERIC', 'PERSONALIZED_ONLY');

-- CreateEnum
CREATE TYPE "GuestEventState" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "GuestAccessCredentialState" AS ENUM ('ISSUED', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StaffGrantState" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'NOT_ATTENDING');

-- CreateEnum
CREATE TYPE "RsvpSource" AS ENUM ('PERSONALIZED', 'PUBLIC', 'OWNER');

-- CreateEnum
CREATE TYPE "PublicRsvpApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceState" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'CORRECTED_CHECKED_IN');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('OWNER', 'STAFF', 'SYSTEM', 'GUEST');

-- CreateEnum
CREATE TYPE "QrCredentialState" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'AUDIO', 'QRIS');

-- CreateEnum
CREATE TYPE "MediaAssetState" AS ENUM ('TEMP_UPLOADED', 'VALIDATING', 'READY', 'REJECTED', 'DELETE_PENDING', 'DELETED', 'EXPIRED_ORPHAN');

-- CreateEnum
CREATE TYPE "MediaVariantKind" AS ENUM ('THUMB', 'MEDIUM', 'LARGE', 'PLAYBACK');

-- CreateEnum
CREATE TYPE "GiftMethodType" AS ENUM ('BANK', 'E_WALLET', 'QRIS');

-- CreateEnum
CREATE TYPE "PaymentOrderState" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'EXPIRED', 'FAILED', 'REFUND_REVIEW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_SUCCEEDED', 'PAYMENT_EXPIRED', 'PAYMENT_FAILED', 'REFUND_REVIEW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('PENDING', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "EmailDeliveryState" AS ENUM ('QUEUED', 'PROVIDER_ACCEPTED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "WishState" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ExportJobState" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "deletion_state" "AccountDeletionState" NOT NULL DEFAULT 'ACTIVE',
    "deletion_requested_at" TIMESTAMPTZ(3),
    "deletion_committed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "owner_facing_title" TEXT NOT NULL,
    "couple_display_name_1" TEXT NOT NULL,
    "couple_display_name_2" TEXT NOT NULL,
    "full_names" JSONB,
    "parent_fields" JSONB,
    "language" TEXT NOT NULL DEFAULT 'id',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "theme_id" TEXT NOT NULL,
    "theme_version" TEXT NOT NULL,
    "theme_config" JSONB NOT NULL,
    "publication_state" "PublicationState" NOT NULL DEFAULT 'DRAFT',
    "commercial_state" "CommercialState" NOT NULL DEFAULT 'TRIAL',
    "trial_started_at" TIMESTAMPTZ(3) NOT NULL,
    "trial_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "active_until" TIMESTAMPTZ(3),
    "grace_ends_at" TIMESTAMPTZ(3),
    "price_locked_amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "primary_event_id" TEXT,
    "generic_access_enabled" BOOLEAN NOT NULL DEFAULT true,
    "shared_password_hash" TEXT,
    "access_version" INTEGER NOT NULL DEFAULT 1,
    "guest_sharing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rsvp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "public_rsvp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "guestbook_enabled" BOOLEAN NOT NULL DEFAULT true,
    "guestbook_moderated" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_members" (
    "invitation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "InvitationRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitation_members_pkey" PRIMARY KEY ("invitation_id","user_id")
);

-- CreateTable
CREATE TABLE "invitation_slugs" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitation_slugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_content" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "opening" JSONB,
    "closing" JSONB,
    "quote_or_prayer" JSONB,
    "hashtag" TEXT,
    "sections" JSONB,
    "section_order" JSONB,
    "cover_media_asset_id" TEXT,
    "share_cover_media_asset_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitation_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "timezone" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'GENERIC',
    "venue" TEXT,
    "address" TEXT,
    "maps_url" TEXT,
    "location_note" TEXT,
    "livestream_url" TEXT,
    "dress_code" TEXT,
    "contact_fields" JSONB,
    "rsvp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rsvp_closes_at" TIMESTAMPTZ(3),
    "check_in_opens_at" TIMESTAMPTZ(3),
    "check_in_closes_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_groups" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "guest_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_phone" TEXT,
    "display_phone" TEXT,
    "notes" TEXT,
    "group_id" TEXT,
    "default_max_party_size" INTEGER,
    "distribution_status" TEXT,
    "last_viewed_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_events" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "state" "GuestEventState" NOT NULL DEFAULT 'ACTIVE',
    "max_party_size" INTEGER NOT NULL,
    "rsvp_eligible" BOOLEAN NOT NULL DEFAULT true,
    "check_in_eligible" BOOLEAN NOT NULL DEFAULT true,
    "public_rsvp_approval" "PublicRsvpApprovalState" NOT NULL DEFAULT 'PENDING',
    "removed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "guest_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_activation_credentials" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "state" "GuestAccessCredentialState" NOT NULL DEFAULT 'ISSUED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "guest_activation_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "session_digest" TEXT NOT NULL,
    "access_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_password_sessions" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "session_digest" TEXT NOT NULL,
    "access_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "invitation_password_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_grants" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credential_digest" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "StaffGrantState" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_grant_events" (
    "staff_grant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "staff_grant_events_pkey" PRIMARY KEY ("staff_grant_id","event_id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "staff_grant_id" TEXT NOT NULL,
    "session_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" TEXT NOT NULL,
    "guest_event_id" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "attendance_count" INTEGER,
    "not_attending_reason" TEXT,
    "source" "RsvpSource" NOT NULL DEFAULT 'PERSONALIZED',
    "owner_override" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishes" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "guest_id" TEXT,
    "sender_display_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "state" "WishState" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "hidden_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "guest_event_id" TEXT NOT NULL,
    "state" "AttendanceState" NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "actual_count" INTEGER,
    "first_checked_in_at" TIMESTAMPTZ(3),
    "last_correction_at" TIMESTAMPTZ(3),
    "variance_flag" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_audits" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "request_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_credentials" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "state" "QrCredentialState" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "qr_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "original_key" TEXT NOT NULL,
    "state" "MediaAssetState" NOT NULL DEFAULT 'TEMP_UPLOADED',
    "size_bytes" BIGINT,
    "mime_type" TEXT,
    "validated_metadata" JSONB,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMPTZ(3),
    "deletion_queued_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "kind" "MediaVariantKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_methods" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "type" "GiftMethodType" NOT NULL,
    "bank_or_wallet_label" TEXT,
    "account_number" TEXT,
    "account_owner_name" TEXT,
    "qr_media_asset_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gift_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_reference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "state" "PaymentOrderState" NOT NULL DEFAULT 'CREATED',
    "provider_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "provider_reference" TEXT,
    "state" "PaymentOrderState" NOT NULL DEFAULT 'CREATED',
    "provider_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "dedup_fingerprint" TEXT NOT NULL,
    "type" "PaymentEventType" NOT NULL,
    "minimal_reference" JSONB,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_records" (
    "id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "invitation_ref" TEXT NOT NULL,
    "transaction_ref" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_date" TIMESTAMPTZ(3),
    "refund_amount" DECIMAL(12,2),
    "duplicate_payment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "state" "JobState" NOT NULL DEFAULT 'PENDING',
    "dedup_key" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "run_after" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(3),
    "heartbeat_at" TIMESTAMPTZ(3),
    "timeout_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT,
    "user_id" TEXT,
    "template_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "state" "EmailDeliveryState" NOT NULL DEFAULT 'QUEUED',
    "queued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "suppression_outcome" TEXT,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suppressed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corrected_at" TIMESTAMPTZ(3),

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "invitation_id" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "state" "ExportJobState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "export_job_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "invitations_owner_id_idx" ON "invitations"("owner_id");

-- CreateIndex
CREATE INDEX "invitations_commercial_state_trial_ends_at_idx" ON "invitations"("commercial_state", "trial_ends_at");

-- CreateIndex
CREATE INDEX "invitations_publication_state_idx" ON "invitations"("publication_state");

-- CreateIndex
CREATE INDEX "invitation_members_user_id_role_idx" ON "invitation_members"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_slugs_slug_key" ON "invitation_slugs"("slug");

-- CreateIndex
CREATE INDEX "invitation_slugs_invitation_id_is_canonical_idx" ON "invitation_slugs"("invitation_id", "is_canonical");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_content_invitation_id_key" ON "invitation_content"("invitation_id");

-- CreateIndex
CREATE INDEX "events_invitation_id_starts_at_idx" ON "events"("invitation_id", "starts_at");

-- CreateIndex
CREATE INDEX "events_invitation_id_archived_at_idx" ON "events"("invitation_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_groups_invitation_id_name_key" ON "guest_groups"("invitation_id", "name");

-- CreateIndex
CREATE INDEX "guests_invitation_id_archived_at_idx" ON "guests"("invitation_id", "archived_at");

-- CreateIndex
CREATE INDEX "guests_invitation_id_normalized_phone_idx" ON "guests"("invitation_id", "normalized_phone");

-- CreateIndex
CREATE INDEX "guest_events_event_id_state_idx" ON "guest_events"("event_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "guest_events_guest_id_event_id_key" ON "guest_events"("guest_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_activation_credentials_digest_key" ON "guest_activation_credentials"("digest");

-- CreateIndex
CREATE INDEX "guest_activation_credentials_guest_id_state_idx" ON "guest_activation_credentials"("guest_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "guest_activation_credentials_guest_id_version_key" ON "guest_activation_credentials"("guest_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_session_digest_key" ON "guest_sessions"("session_digest");

-- CreateIndex
CREATE INDEX "guest_sessions_guest_id_expires_at_idx" ON "guest_sessions"("guest_id", "expires_at");

-- CreateIndex
CREATE INDEX "guest_sessions_invitation_id_expires_at_idx" ON "guest_sessions"("invitation_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_password_sessions_session_digest_key" ON "invitation_password_sessions"("session_digest");

-- CreateIndex
CREATE INDEX "invitation_password_sessions_invitation_id_expires_at_idx" ON "invitation_password_sessions"("invitation_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_grants_credential_digest_key" ON "staff_grants"("credential_digest");

-- CreateIndex
CREATE INDEX "staff_grants_invitation_id_state_idx" ON "staff_grants"("invitation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_session_digest_key" ON "staff_sessions"("session_digest");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_grant_id_expires_at_idx" ON "staff_sessions"("staff_grant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_guest_event_id_key" ON "rsvps"("guest_event_id");

-- CreateIndex
CREATE INDEX "rsvps_status_idx" ON "rsvps"("status");

-- CreateIndex
CREATE INDEX "wishes_invitation_id_state_submitted_at_idx" ON "wishes"("invitation_id", "state", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "wishes_invitation_id_guest_id_key" ON "wishes"("invitation_id", "guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_guest_event_id_key" ON "attendance"("guest_event_id");

-- CreateIndex
CREATE INDEX "attendance_audits_attendance_id_created_at_idx" ON "attendance_audits"("attendance_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_audits_event_id_created_at_idx" ON "attendance_audits"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "qr_credentials_digest_key" ON "qr_credentials"("digest");

-- CreateIndex
CREATE UNIQUE INDEX "qr_credentials_guest_id_version_key" ON "qr_credentials"("guest_id", "version");

-- CreateIndex
CREATE INDEX "media_assets_invitation_id_state_idx" ON "media_assets"("invitation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_media_asset_id_kind_key" ON "media_variants"("media_asset_id", "kind");

-- CreateIndex
CREATE INDEX "gift_methods_invitation_id_active_sort_order_idx" ON "gift_methods"("invitation_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "payment_orders_invitation_id_state_idx" ON "payment_orders"("invitation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_provider_provider_reference_key" ON "payment_orders"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_order_id_state_idx" ON "payment_attempts"("payment_order_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_payment_order_id_provider_reference_key" ON "payment_attempts"("payment_order_id", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_dedup_fingerprint_key" ON "payment_events"("dedup_fingerprint");

-- CreateIndex
CREATE INDEX "payment_events_payment_order_id_received_at_idx" ON "payment_events"("payment_order_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_payment_order_id_provider_event_id_key" ON "payment_events"("payment_order_id", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_records_payment_order_id_key" ON "financial_records"("payment_order_id");

-- CreateIndex
CREATE INDEX "financial_records_transaction_ref_idx" ON "financial_records"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedup_key_key" ON "jobs"("dedup_key");

-- CreateIndex
CREATE INDEX "jobs_state_run_after_priority_idx" ON "jobs"("state", "run_after", "priority");

-- CreateIndex
CREATE INDEX "jobs_lease_expires_at_idx" ON "jobs"("lease_expires_at");

-- CreateIndex
CREATE INDEX "email_deliveries_invitation_id_state_idx" ON "email_deliveries"("invitation_id", "state");

-- CreateIndex
CREATE INDEX "email_deliveries_user_id_state_idx" ON "email_deliveries"("user_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");

-- CreateIndex
CREATE INDEX "audit_events_invitation_id_created_at_idx" ON "audit_events"("invitation_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_invitation_id_state_idx" ON "export_jobs"("invitation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "export_artifacts_export_job_id_key" ON "export_artifacts"("export_job_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_primary_event_id_fkey" FOREIGN KEY ("primary_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_members" ADD CONSTRAINT "invitation_members_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_members" ADD CONSTRAINT "invitation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_slugs" ADD CONSTRAINT "invitation_slugs_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_content" ADD CONSTRAINT "invitation_content_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_groups" ADD CONSTRAINT "guest_groups_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "guest_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_events" ADD CONSTRAINT "guest_events_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_events" ADD CONSTRAINT "guest_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_activation_credentials" ADD CONSTRAINT "guest_activation_credentials_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_password_sessions" ADD CONSTRAINT "invitation_password_sessions_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_grants" ADD CONSTRAINT "staff_grants_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_grant_events" ADD CONSTRAINT "staff_grant_events_staff_grant_id_fkey" FOREIGN KEY ("staff_grant_id") REFERENCES "staff_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_grant_events" ADD CONSTRAINT "staff_grant_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_grant_id_fkey" FOREIGN KEY ("staff_grant_id") REFERENCES "staff_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_guest_event_id_fkey" FOREIGN KEY ("guest_event_id") REFERENCES "guest_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_guest_event_id_fkey" FOREIGN KEY ("guest_event_id") REFERENCES "guest_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audits" ADD CONSTRAINT "attendance_audits_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_credentials" ADD CONSTRAINT "qr_credentials_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_methods" ADD CONSTRAINT "gift_methods_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_methods" ADD CONSTRAINT "gift_methods_qr_media_asset_id_fkey" FOREIGN KEY ("qr_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
