-- INV-007 stores the server-owned voluntary deletion deadline on the
-- invitation. Financial records survive product-data purge independently of
-- the payment order that originally carried the invitation reference.
ALTER TABLE "invitations"
    ADD COLUMN "deletion_requested_at" TIMESTAMPTZ(3),
    ADD COLUMN "purge_at" TIMESTAMPTZ(3);

CREATE INDEX "invitations_commercial_state_purge_at_idx"
    ON "invitations"("commercial_state", "purge_at");

ALTER TABLE "financial_records"
    DROP CONSTRAINT "financial_records_payment_order_id_fkey";

ALTER TABLE "financial_records"
    ALTER COLUMN "payment_order_id" DROP NOT NULL;

ALTER TABLE "financial_records"
    ADD CONSTRAINT "financial_records_payment_order_id_fkey"
    FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
