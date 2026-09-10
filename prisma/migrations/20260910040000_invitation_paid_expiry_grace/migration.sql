-- Index the scheduler's paid-expiry and grace-expiry sweeps without changing
-- the existing invitation lifecycle data model.
CREATE INDEX "invitations_commercial_state_active_until_idx"
    ON "invitations"("commercial_state", "active_until");

CREATE INDEX "invitations_commercial_state_grace_ends_at_idx"
    ON "invitations"("commercial_state", "grace_ends_at");
